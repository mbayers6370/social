import "server-only";
import {
  topFriendCandidates,
  readTopFriends,
  saveTopFriends,
} from "./top-friends";
import { ownedReadablePhotos } from "./photo-visibility";
import sharp from "sharp";
import { SpaceService } from "@/server/spaces/service";
import {
  missingSpaceInvitationNotifications,
  spaceInvitationId,
  spaceInvitationNotificationKey,
  visibleSpaceInvitation,
} from "@/server/spaces/invitation-notifications";
import { SocialError } from "@/server/social/errors";
import { retireUnreferencedPhotos } from "@/server/spaces/media-lifecycle";
import { memberPerson } from "@/lib/member-person";
import { catalogue } from "@/server/music/catalogue";
import { profileTrackFromRow } from "@/server/music/selections";
import { musicChangeSchema } from "@/features/profile/music-schema";
import { isReservedUsername } from "@/features/profile/username";
import {
  memberTopFriendsInput,
  memberProfileInput,
  memberPreferencesInput,
  memberUsernameInput,
  memberGalleryInput,
  memberMessageInput,
  memberPostDraftInput,
} from "@/features/social/member-schema";
import type {
  MemberIdentity,
  MemberContact,
  MemberConversation,
  MemberThread,
  MemberActivity,
} from "@/features/social/member-contracts";
import { Prisma } from "@/generated/prisma/client";
import { containsPostLink } from "@/lib/platform-rules";
import { messageCutoff } from "@/lib/message-policy";
import {
  recordPublication,
  memberPostingWindow,
} from "@/server/social/posting-allowance";

const active = { account: { is: { status: "ACTIVE" as const } } };
const accountSelect = {
  displayName: true,
  username: true,
  bio: true,
  portraitPhotoId: true,
  messagingEnabled: true,
} as const;
const unavailable = () => new SocialError(404, "This item is unavailable");
const pair = (a: string, b: string) =>
  a < b ? { lowId: a, highId: b } : { lowId: b, highId: a };

/** Completes the existing DAL; account identity, post/media lifecycles, audience
 * checks and transactions remain owned by SocialService/SpaceService. */
export class MemberService extends SpaceService {
  async postingAllowance(subject: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      return this.dailyPostAllowance(tx, actor, this.clock());
    });
  }
  async editPersonalPost(subject: string, id: string, body: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor]);
      const post = await tx.post.findFirst({
        where: {
          id,
          ownerId: actor,
          deletedAt: null,
          expiresAt: { gt: this.clock() },
        },
        select: {
          id: true,
          ownerId: true,
          spaceId: true,
          createdAt: true,
          _count: { select: { photos: true } },
        },
      });
      if (!post) throw unavailable();
      if (!body.trim() && !post._count.photos)
        throw new SocialError(400, "Write a thought before saving.");
      const hasLink = containsPostLink({ body });
      if (post.spaceId) {
        if (body.trim().length > 2000)
          throw new SocialError(
            400,
            "Space posts can contain up to 2,000 characters.",
          );
        await this.postAudience(tx, actor, post, true);
      } else await this.quota(tx, actor, hasLink, post.createdAt, id);
      const updated = await tx.post.update({
        where: { id },
        data: { body: body.trim(), hasLink },
      });
      await recordPublication(tx, updated);
      return { saved: true };
    });
  }
  async publishPersonal(
    subject: string,
    raw: unknown,
    files: { bytes: Uint8Array; type: string; description: string }[] = [],
  ) {
    const input = memberPostDraftInput.parse(raw);
    if (!input.body && !input.photoIds.length && !files.length)
      throw new SocialError(400, "Write a post or choose a photograph.");
    if (files.length)
      return this.publishWithUploads(subject, undefined, input, files);
    return this.transaction((tx) =>
      this.publishInTransaction(tx, subject, undefined, input),
    );
  }
  async personalPhotos(subject: string, before?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const rows = await tx.photo.findMany({
        where: {
          ...ownedReadablePhotos(actor, this.clock()),
          ...(before ? { id: { lt: before } } : {}),
        },
        select: { id: true, description: true, width: true, height: true },
        orderBy: { id: "desc" },
        take: 21,
      });
      return {
        photos: rows.slice(0, 20),
        nextCursor: rows.length > 20 ? rows[19].id : null,
      };
    });
  }
  async identity(subject: string): Promise<MemberIdentity> {
    return this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      const account = await tx.account.findUniqueOrThrow({
        where: { userId: id },
      });
      return {
        founder: account.role === "FOUNDER",
        person: memberPerson(id, account),
        username: account.username ?? "",
        bio: account.bio,
        portraitPhotoId: account.portraitPhotoId,
        usernameChangedAt: account.usernameChangedAt?.toISOString() ?? null,
        galleryVersion: account.galleryVersion,
        preferences: {
          postingTimeZone: account.postingTimeZone,
          showTopFriends: account.showTopFriends,
          readingSize:
            account.readingSize === "larger" ||
            account.readingSize === "extra-large"
              ? account.readingSize
              : "standard",
          motion: account.motion === "reduced" ? "reduced" : "system",
          notifyComments: account.notifyComments,
          notifyLikes: account.notifyLikes,
          notifyFriends: account.notifyFriends,
          notifyMessages: account.notifyMessages,
          messagingEnabled: account.messagingEnabled,
        },
      };
    });
  }
  async updateProfile(subject: string, raw: unknown) {
    const { name, bio } = memberProfileInput.parse(raw);
    await this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      await tx.account.update({
        where: { userId: id },
        data: { displayName: name, bio },
      });
    });
    return this.identity(subject);
  }
  async updatePreferences(subject: string, raw: unknown) {
    const data = memberPreferencesInput.parse(raw);
    await this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      const previous = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: { postingTimeZone: true, postingUsageCarryUntil: true },
      });
      const previousWindow =
        data.postingTimeZone &&
        data.postingTimeZone !== previous.postingTimeZone
          ? await memberPostingWindow(tx, id, this.clock())
          : null;
      await tx.account.update({
        where: { userId: id },
        data: {
          ...data,
          ...(data.postingTimeZone &&
          data.postingTimeZone !== previous.postingTimeZone
            ? {
                postingUsageCarryFrom: new Date(
                  Math.min(
                    previousWindow!.start.getTime(),
                    this.clock().getTime() - 86_400_000,
                  ),
                ),
                postingUsageCarryUntil: new Date(
                  Math.max(
                    previousWindow!.end.getTime(),
                    previous.postingUsageCarryUntil?.getTime() ?? 0,
                    this.clock().getTime() + 86_400_000,
                  ),
                ),
              }
            : {}),
        },
      });
    });
    return this.identity(subject);
  }
  async updateUsername(subject: string, raw: unknown) {
    const { username } = memberUsernameInput.parse(raw);
    if (isReservedUsername(username))
      throw new SocialError(409, "That username is unavailable.");
    try {
      await this.transaction(async (tx) => {
        const id = await this.actor(tx, subject);
        await this.lock(tx, [id]);
        const account = await tx.account.findUniqueOrThrow({
          where: { userId: id },
        });
        if (account.username === username) return;
        if (account.usernameChangedAt)
          throw new SocialError(
            409,
            "Your one username change has already been used.",
          );
        await tx.account.update({
          where: { userId: id },
          data: { username, usernameChangedAt: this.clock() },
        });
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new SocialError(409, "That username is unavailable.");
      throw error;
    }
    return this.identity(subject);
  }
  async setPortrait(subject: string, photoId: string | null) {
    await this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      if (
        photoId &&
        !(await tx.galleryEntry.findFirst({
          where: { ownerId: id, photoId, photo: { state: "READY" } },
          select: { photoId: true },
        }))
      )
        throw unavailable();
      const previous = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: { portraitPhotoId: true },
      });
      await tx.account.update({
        where: { userId: id },
        data: { portraitPhotoId: photoId },
      });
      if (previous.portraitPhotoId && previous.portraitPhotoId !== photoId)
        await retireUnreferencedPhotos(
          tx,
          [previous.portraitPhotoId],
          this.clock(),
        );
    });
    return this.identity(subject);
  }
  async portrait(subject: string, ownerId: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor, ownerId]);
      if (await this.blocked(tx, actor, ownerId)) throw unavailable();
      const account = await tx.account.findFirst({
        where: {
          userId: ownerId,
          status: "ACTIVE",
          portrait: { is: { ownerId, state: "READY" } },
        },
        select: { portrait: { select: { objectKey: true } } },
      });
      if (!account?.portrait) throw unavailable();
      // Only the profile-sized crop is visible with a profile introduction. The
      // original remains behind its existing friends/Space media authorization.
      return sharp(await this.store.get(account.portrait.objectKey))
        .resize(208, 208, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();
    });
  }
  async uploadGallery(
    subject: string,
    bytes: Uint8Array,
    type: string,
    description = "Photograph",
    replacementPhotoId?: string,
  ) {
    return (
      await this.uploadPhoto(
        subject,
        bytes,
        type,
        description,
        undefined,
        true,
        replacementPhotoId,
      )
    ).photo;
  }
  async arrangeGallery(subject: string, raw: unknown) {
    const input = memberGalleryInput.parse(raw);
    const retired = await this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      const account = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: { galleryVersion: true },
      });
      if (account.galleryVersion !== input.version)
        throw new SocialError(
          409,
          "Your gallery changed. Close and reopen the editor before saving.",
        );
      const ids = input.entries.map((entry) => entry.photoId);
      for (const photoId of ids) {
        const photo = await this.photoAudience(tx, id, photoId);
        if (photo.ownerId !== id) throw unavailable();
      }
      const previous = await tx.galleryEntry.findMany({
        where: { ownerId: id },
        select: { photoId: true },
      });
      if (
        input.deletedPhotoIds.some(
          (photoId) =>
            ids.includes(photoId) ||
            !previous.some((entry) => entry.photoId === photoId),
        ) ||
        new Set(input.deletedPhotoIds).size !== input.deletedPhotoIds.length
      )
        throw new SocialError(400, "Choose a gallery photograph to delete.");
      const retired: { id: string; key: string }[] = [];
      for (const photoId of input.deletedPhotoIds) {
        const key = await this.retirePhoto(tx, id, photoId);
        if (key) retired.push({ id: photoId, key });
      }
      await tx.galleryEntry.deleteMany({ where: { ownerId: id } });
      for (const [position, entry] of input.entries.entries())
        await tx.galleryEntry.create({
          data: { ...entry, ownerId: id, position },
        });
      await tx.account.update({
        where: { userId: id },
        data: { galleryVersion: { increment: 1 } },
      });
      await retireUnreferencedPhotos(
        tx,
        previous
          .map((entry) => entry.photoId)
          .filter((photoId) => !ids.includes(photoId)),
        this.clock(),
      );
      return retired;
    });
    for (const photo of retired) {
      await this.store.delete(photo.key);
      await this.db.photo.updateMany({
        where: { id: photo.id, state: "DELETE_PENDING" },
        data: { state: "PURGED", description: "" },
      });
    }
    return { saved: true };
  }
  async music(subject: string, raw: unknown) {
    const { action, trackId } = musicChangeSchema.parse(raw);
    if ((await this.account(subject))?.accountStatus !== "ACTIVE")
      throw new SocialError(403, "Account is not active");
    const track = action === "add" ? await catalogue.lookup(trackId) : null;
    return this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      if (action === "remove")
        await tx.profileSong.deleteMany({
          where: { userId: id, providerTrackId: trackId },
        });
      else if (track) {
        await tx.profileSong.deleteMany({ where: { userId: id } });
        await tx.profileSong.create({
          data: {
            userId: id,
            position: 0,
            providerTrackId: track.id,
            title: track.title,
            artist: track.artist,
            artworkUrl: track.artwork?.src,
            appleUrl: track.appleMusicUrl!,
            spotifyUrl: track.spotifyUrl!,
          },
        });
      }
      return {
        tracks: (
          await tx.profileSong.findMany({
            where: { userId: id },
            orderBy: { position: "asc" },
          })
        ).map(profileTrackFromRow),
      };
    });
  }
  async topFriends(subject: string, query = "", before?: string) {
    return this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      return topFriendCandidates(tx, ownerId, query, before);
    });
  }
  async updateTopFriends(subject: string, raw: unknown) {
    const input = memberTopFriendsInput.parse(raw);
    return this.transaction(async (tx) => {
      const ownerId = await this.actor(tx, subject);
      await this.lock(tx, [ownerId, ...input.friendIds]);
      return saveTopFriends(tx, ownerId, input);
    });
  }
  async contacts(subject: string, query = "", before?: string) {
    const term = query.trim().replace(/^@/, "");
    if (term && (term.length < 2 || term.length > 80))
      throw new SocialError(400, "Enter 2–80 characters.");
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const rows = await tx.user.findMany({
        where: {
          ...active,
          id: { not: actor, ...(before ? { gt: before } : {}) },
          blocksSent: { none: { blockedId: actor } },
          blocksReceived: { none: { blockerId: actor } },
          OR: term
            ? [
                {
                  account: {
                    is: { username: { contains: term, mode: "insensitive" } },
                  },
                },
                {
                  account: {
                    is: {
                      displayName: { contains: term, mode: "insensitive" },
                    },
                  },
                },
              ]
            : [
                { friendshipsLow: { some: { highId: actor } } },
                { friendshipsHigh: { some: { lowId: actor } } },
              ],
        },
        select: {
          id: true,
          account: {
            select: {
              displayName: true,
              username: true,
              portraitPhotoId: true,
            },
          },
        },
        orderBy: { id: "asc" },
        take: 31,
      });
      const links = await tx.friendship.findMany({
        where: { OR: [{ lowId: actor }, { highId: actor }] },
      });
      const acceptedKeys = links
        .filter(
          (link) =>
            link.status === "ACCEPTED" &&
            rows
              .slice(0, 30)
              .some((row) => row.id === link.lowId || row.id === link.highId),
        )
        .map((link) => `friend-accepted:${link.lowId}:${link.highId}`);
      // Acceptance activity is kept for the current friendship and removed on
      // unfriend/block. Undated legacy relationships must not gain invented dates.
      const accepted = acceptedKeys.length
        ? await tx.memberNotification.findMany({
            where: {
              kind: "friend_accepted",
              dedupeKey: { in: acceptedKeys },
              OR: [{ recipientId: actor }, { actorId: actor }],
            },
            select: { dedupeKey: true, createdAt: true },
          })
        : [];
      const dates = new Map(
        accepted.map((row) => [row.dedupeKey, row.createdAt.toISOString()]),
      );
      const contacts: MemberContact[] = rows.slice(0, 30).map((row) => {
        const link = links.find(
          (link) => link.lowId === row.id || link.highId === row.id,
        );
        return {
          person: memberPerson(row.id, row.account!),
          username: row.account!.username ?? "",
          friendsSince:
            link?.status === "ACCEPTED"
              ? (dates.get(`friend-accepted:${link.lowId}:${link.highId}`) ??
                null)
              : null,
          relationship:
            link?.status === "ACCEPTED"
              ? "friends"
              : link
                ? link.requesterId === actor
                  ? "outgoing"
                  : "incoming"
                : "none",
        };
      });
      return { contacts, nextCursor: rows.length > 30 ? rows[29].id : null };
    });
  }
  private messageWhere(
    actor: string,
    contact: string,
  ): Prisma.MemberMessageWhereInput {
    return {
      createdAt: { gt: messageCutoff(this.clock(), actor === contact) },
      OR: [
        { senderId: actor, recipientId: contact, hiddenBySender: false },
        ...(actor === contact
          ? []
          : [
              {
                senderId: contact,
                recipientId: actor,
                hiddenByRecipient: false,
              },
            ]),
      ],
    };
  }
  private async messagingAccess(
    tx: Prisma.TransactionClient,
    actor: string,
    contact = actor,
    write = false,
  ) {
    if (write) {
      // A waiting serializable sender must retry if either preference changed
      // since its snapshot. User locks alone do not update Account row versions.
      await tx.$queryRaw(
        Prisma.sql`SELECT "userId" FROM "Account" WHERE "userId" IN (${Prisma.join([...new Set([actor, contact])].sort())}) ORDER BY "userId" FOR UPDATE`,
      );
    }
    const accounts = await tx.account.findMany({
      where: { userId: { in: [...new Set([actor, contact])] } },
      select: { userId: true, messagingEnabled: true },
    });
    if (!accounts.find((row) => row.userId === actor)?.messagingEnabled)
      throw new SocialError(
        403,
        "Messaging is off. Turn it on in Settings to use Messages.",
      );
    if (!accounts.find((row) => row.userId === contact)?.messagingEnabled)
      throw unavailable();
  }
  private async thread(
    tx: Prisma.TransactionClient,
    actor: string,
    contact: string,
  ): Promise<MemberThread> {
    await this.messagingAccess(tx, actor, contact);
    const owner = await tx.user.findFirst({
      where: { id: contact, ...active },
      select: { id: true, account: { select: accountSelect } },
    });
    if (!owner) throw unavailable();
    const blocked = await this.blocked(tx, actor, contact);
    const link =
      actor === contact
        ? null
        : await tx.friendship.findUnique({
            where: { lowId_highId: pair(actor, contact) },
          });
    const latest = await tx.memberMessage.findFirst({
      where: this.messageWhere(actor, contact),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (
      actor !== contact &&
      !latest &&
      (blocked || link?.status !== "ACCEPTED")
    )
      throw unavailable();
    const unread =
      actor !== contact &&
      !!(await tx.memberMessage.findFirst({
        where: {
          senderId: contact,
          recipientId: actor,
          hiddenByRecipient: false,
          readAt: null,
          createdAt: { gt: messageCutoff(this.clock()) },
        },
        select: { id: true },
      }));
    return {
      id: contact,
      contact: memberPerson(contact, {
        ...owner.account!,
        ...(blocked ? { portraitPhotoId: null } : {}),
      }),
      notebook: actor === contact,
      unread,
      preview: latest?.body ?? "",
      updatedAt: latest?.createdAt.toISOString() ?? null,
      canSend: actor === contact || (!blocked && link?.status === "ACCEPTED"),
    };
  }
  async threads(subject: string, before?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.messagingAccess(tx, actor);
      const people = await tx.user.findMany({
        where: {
          account: { is: { status: "ACTIVE", messagingEnabled: true } },
          id: { not: actor, ...(before ? { gt: before } : {}) },
          OR: [
            { friendshipsLow: { some: { highId: actor, status: "ACCEPTED" } } },
            { friendshipsHigh: { some: { lowId: actor, status: "ACCEPTED" } } },
            {
              sentMessages: {
                some: {
                  recipientId: actor,
                  hiddenByRecipient: false,
                  createdAt: { gt: messageCutoff(this.clock()) },
                },
              },
            },
            {
              receivedMessages: {
                some: {
                  senderId: actor,
                  hiddenBySender: false,
                  createdAt: { gt: messageCutoff(this.clock()) },
                },
              },
            },
          ],
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take: 51,
      });
      const threads: MemberThread[] = before
        ? []
        : [await this.thread(tx, actor, actor)];
      for (const person of people.slice(0, 50)) {
        try {
          threads.push(await this.thread(tx, actor, person.id));
        } catch (error) {
          if (!(error instanceof SocialError && error.status === 404))
            throw error;
        }
      }
      threads.sort(
        (a, b) =>
          Number(b.notebook) - Number(a.notebook) ||
          (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") ||
          a.id.localeCompare(b.id),
      );
      return { threads, nextCursor: people.length > 50 ? people[49].id : null };
    });
  }
  async conversation(
    subject: string,
    contact: string,
    before?: string,
  ): Promise<MemberConversation> {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const thread = await this.thread(tx, actor, contact);
      const where = this.messageWhere(actor, contact);
      const anchor = before
        ? await tx.memberMessage.findFirst({
            where: { AND: [where, { id: before }] },
            select: { id: true, createdAt: true },
          })
        : null;
      if (before && !anchor) throw unavailable();
      const rows = await tx.memberMessage.findMany({
        where: {
          AND: [
            where,
            ...(anchor
              ? [
                  {
                    OR: [
                      { createdAt: { lt: anchor.createdAt } },
                      { createdAt: anchor.createdAt, id: { lt: anchor.id } },
                    ],
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      });
      return {
        thread,
        messages: rows
          .slice(0, 50)
          .reverse()
          .map((row) => ({
            id: row.id,
            body: row.body,
            direction: row.senderId === actor ? "outgoing" : "incoming",
            createdAt: row.createdAt.toISOString(),
          })),
        nextCursor: rows.length > 50 ? rows[49].id : null,
      };
    });
  }
  async sendMessage(subject: string, contact: string, raw: unknown) {
    const input = memberMessageInput.parse(raw);
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor, contact]);
      await this.messagingAccess(tx, actor, contact, true);
      const previous = await tx.memberMessage.findUnique({
        where: {
          senderId_requestId: { senderId: actor, requestId: input.requestId },
        },
        select: { id: true, recipientId: true, body: true, createdAt: true },
      });
      if (previous) {
        if (
          previous.createdAt <= messageCutoff(this.clock(), actor === contact)
        )
          throw new SocialError(
            409,
            "That message request has expired. Start a new message.",
          );
        if (previous.recipientId !== contact || previous.body !== input.body)
          throw new SocialError(
            409,
            "This request was already used for another message.",
          );
        return { id: previous.id };
      }
      if (actor !== contact) await this.audience(tx, actor, contact);
      const saved = await tx.memberMessage.create({
        data: {
          senderId: actor,
          recipientId: contact,
          body: input.body,
          requestId: input.requestId,
          createdAt: this.clock(),
          ...(actor === contact ? { readAt: this.clock() } : {}),
        },
        select: { id: true },
      });
      if (actor !== contact)
        await this.notify(tx, contact, actor, "message", `message:${saved.id}`);
      return saved;
    });
  }
  async exportConversation(subject: string, contact: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const thread = await this.thread(tx, actor, contact);
      const rows = await tx.memberMessage.findMany({
        where: this.messageWhere(actor, contact),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 10001,
        select: { id: true, body: true, senderId: true, createdAt: true },
      });
      if (rows.length > 10000)
        throw new SocialError(
          409,
          "This conversation needs an assisted export. Contact support@margin.social.",
        );
      return {
        exportedAt: this.clock().toISOString(),
        contact: thread.contact.name,
        messages: rows.map((row) => ({
          id: row.id,
          body: row.body,
          direction: row.senderId === actor ? "outgoing" : "incoming",
          createdAt: row.createdAt.toISOString(),
        })),
      };
    });
  }
  async readConversation(subject: string, contact: string, through?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.thread(tx, actor, contact);
      const anchor = through
        ? await tx.memberMessage.findFirst({
            where: {
              AND: [this.messageWhere(actor, contact), { id: through }],
            },
            select: { id: true, createdAt: true },
          })
        : null;
      if (through && !anchor) throw unavailable();
      if (actor !== contact && anchor)
        await tx.memberMessage.updateMany({
          where: {
            senderId: contact,
            recipientId: actor,
            readAt: null,
            OR: [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lte: anchor.id } },
            ],
          },
          data: { readAt: this.clock() },
        });
      return { saved: true };
    });
  }
  async hideConversation(subject: string, contact: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await this.lock(tx, [actor]);
      await this.thread(tx, actor, contact);
      await tx.memberMessage.updateMany({
        where: { senderId: actor, recipientId: contact },
        data: { hiddenBySender: true },
      });
      if (actor !== contact)
        await tx.memberMessage.updateMany({
          where: { recipientId: actor, senderId: contact },
          data: { hiddenByRecipient: true, readAt: this.clock() },
        });
      await tx.memberMessage.deleteMany({
        where: {
          AND: [
            { OR: [{ senderId: actor }, { recipientId: actor }] },
            {
              OR: [
                { senderId: actor, recipientId: actor, hiddenBySender: true },
                { hiddenBySender: true, hiddenByRecipient: true },
              ],
            },
          ],
        },
      });
      return { saved: true };
    });
  }
  /** Atomic bounded erasure, including notifications that reference message IDs.
   * SKIP LOCKED makes overlapping maintenance invocations safe. */
  async expireMessages(limit = 100) {
    const batch = Math.min(100, Math.max(1, limit));
    const messagesBefore = messageCutoff(this.clock());
    const notesBefore = messageCutoff(this.clock(), true);
    const [result] = await this.db.$queryRaw<
      { messages: number; notifications: number }[]
    >`
      WITH expired AS (
        SELECT id FROM "MemberMessage"
        WHERE ("senderId" = "recipientId" AND "createdAt" <= ${notesBefore})
           OR ("senderId" <> "recipientId" AND "createdAt" <= ${messagesBefore})
        ORDER BY "createdAt", id LIMIT ${batch} FOR UPDATE SKIP LOCKED
      ), erased AS (
        DELETE FROM "MemberMessage" m USING expired e WHERE m.id = e.id RETURNING m.id
      ), obsolete_notifications AS (
        SELECT n.id FROM "MemberNotification" n WHERE n."kind" = 'message' AND (
          n."dedupeKey" IN (SELECT 'message:' || id FROM erased)
          OR n."createdAt" <= ${messagesBefore}
          OR NOT EXISTS (SELECT 1 FROM "MemberMessage" m WHERE m.id = substring(n."dedupeKey" from 9))
        ) ORDER BY n."createdAt", n.id LIMIT ${batch} FOR UPDATE SKIP LOCKED
      ), notifications AS (
        DELETE FROM "MemberNotification" n USING obsolete_notifications o WHERE n.id = o.id RETURNING n.id
      ) SELECT (SELECT count(*)::integer FROM erased) AS messages,
        (SELECT count(*)::integer FROM notifications) AS notifications`;
    return result;
  }
  async like(subject: string, postId: string, liked: boolean) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, expiresAt: { gt: this.clock() } },
        select: { id: true, ownerId: true, spaceId: true },
      });
      if (!post) throw unavailable();
      await this.lock(tx, [actor, post.ownerId]);
      await this.postAudience(tx, actor, post, true);
      if (liked) {
        await tx.postLike.upsert({
          where: { postId_userId: { postId, userId: actor } },
          create: { postId, userId: actor },
          update: {},
        });
        if (actor !== post.ownerId)
          await this.notify(
            tx,
            post.ownerId,
            actor,
            "like",
            `like:${postId}:${actor}`,
            postId,
          );
      } else {
        await tx.postLike.deleteMany({ where: { postId, userId: actor } });
        await tx.memberNotification.deleteMany({
          where: { dedupeKey: `like:${postId}:${actor}` },
        });
      }
      return { liked, count: await tx.postLike.count({ where: { postId } }) };
    });
  }
  async notifications(subject: string, before?: string, includeEvents = true) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      if (!before) {
        const missing = await missingSpaceInvitationNotifications(
          tx,
          actor,
          this.clock(),
        );
        for (const invitation of missing) {
          await this.notify(
            tx,
            actor,
            invitation.inviterId,
            "space_invitation",
            spaceInvitationNotificationKey(invitation.id),
          );
        }
      }
      const settings = await tx.account.findUniqueOrThrow({
        where: { userId: actor },
      });
      const rows = await tx.memberNotification.findMany({
        where: {
          recipientId: actor,
          ...(before ? { id: { lt: before } } : {}),
        },
        include: {
          actor: { select: { id: true, account: { select: accountSelect } } },
          post: {
            select: {
              id: true,
              ownerId: true,
              spaceId: true,
              deletedAt: true,
              expiresAt: true,
              space: { select: { name: true, kind: true } },
            },
          },
        },
        orderBy: { id: "desc" },
        take: 51,
      });
      const activity: MemberActivity[] = [];
      for (const row of rows.slice(0, 50)) {
        if (!includeEvents && row.post?.space?.kind === "EVENT") continue;
        if (!row.actor.account || (await this.blocked(tx, actor, row.actorId)))
          continue;
        if (
          row.kind === "message" &&
          !(await tx.memberMessage.findFirst({
            where: {
              id: row.dedupeKey.startsWith("message:")
                ? row.dedupeKey.slice(8)
                : "",
              senderId: row.actorId,
              recipientId: actor,
              hiddenByRecipient: false,
              createdAt: { gt: messageCutoff(this.clock()) },
            },
            select: { id: true },
          }))
        )
          continue;
        if (
          (row.kind === "message" &&
            (!settings.notifyMessages ||
              !settings.messagingEnabled ||
              !row.actor.account.messagingEnabled)) ||
          (row.kind === "like" && !settings.notifyLikes) ||
          (["comment", "reply"].includes(row.kind) &&
            !settings.notifyComments) ||
          (row.kind.startsWith("friend_") && !settings.notifyFriends)
        )
          continue;
        if (row.kind === "space_invitation") {
          const id = spaceInvitationId(row.dedupeKey);
          const invitation = id
            ? await visibleSpaceInvitation(
                tx,
                actor,
                id,
                this.clock(),
                row.actorId,
              )
            : null;
          if (
            !invitation ||
            (!includeEvents && invitation.space.kind === "EVENT")
          )
            continue;
          activity.push({
            id: row.id,
            actor: memberPerson(row.actor.id, row.actor.account),
            kind: "space_invitation",
            invitation: {
              id: invitation.id,
              space: { name: invitation.space.name },
            },
            href: "/app/spaces#space-invitations",
            createdAt: row.createdAt.toISOString(),
            read: row.readAt !== null,
          });
          continue;
        }
        if (row.post) {
          if (
            row.kind === "space_post" &&
            (!row.post.space || row.post.space.kind === "EVENT")
          )
            continue;
          if (row.post.deletedAt || row.post.expiresAt <= this.clock())
            continue;
          try {
            await this.postAudience(tx, actor, row.post);
          } catch (error) {
            if (
              error instanceof SocialError &&
              [403, 404].includes(error.status)
            )
              continue;
            throw error;
          }
        }
        if (row.kind.startsWith("friend_")) {
          const friendship = await tx.friendship.findUnique({
            where: { lowId_highId: pair(actor, row.actorId) },
          });
          if (
            row.kind === "friend_request"
              ? !friendship ||
                friendship.status !== "PENDING" ||
                friendship.requesterId === actor
              : friendship?.status !== "ACCEPTED"
          )
            continue;
        }
        const kind = row.kind as MemberActivity["kind"];
        const commentId = ["comment", "reply"].includes(kind)
          ? row.dedupeKey.match(
              /^(?:comment|reply):([A-Za-z0-9_-]{1,128})$/,
            )?.[1]
          : undefined;
        if (
          ["comment", "reply"].includes(kind) &&
          (!row.post ||
            !commentId ||
            !(await tx.postComment.findFirst({
              where: {
                id: commentId,
                postId: row.post.id,
                authorId: row.actorId,
                author: { account: { is: { status: "ACTIVE" } } },
              },
              select: { id: true },
            })))
        )
          continue;
        const postQuery = row.post
          ? new URLSearchParams({
              post: row.post.id,
              ...(commentId ? { comment: commentId } : {}),
            })
          : null;
        activity.push({
          id: row.id,
          actor: memberPerson(row.actor.id, row.actor.account),
          kind,
          ...(kind === "space_post" && row.post?.space
            ? { spaceName: row.post.space.name }
            : {}),
          href:
            row.kind === "message"
              ? `/app/messages?thread=${encodeURIComponent(row.actorId)}`
              : row.post
                ? row.post.spaceId
                  ? `/app/spaces/${encodeURIComponent(row.post.spaceId)}?${postQuery}#${encodeURIComponent(row.post.id)}`
                  : `/app?person=${encodeURIComponent(row.post.ownerId)}&${postQuery}#${encodeURIComponent(row.post.id)}`
                : `/app?person=${encodeURIComponent(row.actorId)}`,
          createdAt: row.createdAt.toISOString(),
          read: row.readAt !== null,
        });
      }
      return { activity, nextCursor: rows.length > 50 ? rows[49].id : null };
    });
  }
  async readNotifications(subject: string, id?: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      await tx.memberNotification.updateMany({
        where: { recipientId: actor, readAt: null, ...(id ? { id } : {}) },
        data: { readAt: this.clock() },
      });
      return { saved: true };
    });
  }
  async safety(subject: string) {
    return this.transaction(async (tx) => {
      const actor = await this.actor(tx, subject);
      const blocked = await tx.block.findMany({
        where: { blockerId: actor },
        select: {
          blocked: {
            select: { id: true, account: { select: { displayName: true } } },
          },
        },
        take: 100,
      });
      const reports = await tx.safetyReport.findMany({
        where: { reporterId: actor },
        select: {
          id: true,
          reason: true,
          status: true,
          targetKind: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return {
        blocked: blocked.map((row) => ({
          id: row.blocked.id,
          name: row.blocked.account?.displayName ?? "Margin member",
        })),
        reports: reports.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    });
  }
  async exportAccount(subject: string) {
    return this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      const profile = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: {
          displayName: true,
          username: true,
          bio: true,
          readingSize: true,
          motion: true,
          usernameChangedAt: true,
          portraitPhotoId: true,
          notifyComments: true,
          notifyFriends: true,
          notifyLikes: true,
          notifyMessages: true,
          messagingEnabled: true,
          showTopFriends: true,
        },
      });
      // Export only this member's records; no session, provider credentials,
      // private object keys, unaccepted profiles, or other people's reports.
      const posts = await tx.post.findMany({
        where: {
          ownerId: id,
          deletedAt: null,
          expiresAt: { gt: this.clock() },
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          expiresAt: true,
          spaceId: true,
        },
        take: 10001,
      });
      const photos = await tx.photo.findMany({
        where: ownedReadablePhotos(id, this.clock()),
        select: {
          id: true,
          description: true,
          createdAt: true,
          width: true,
          height: true,
        },
        take: 10001,
      });
      const messages = await tx.memberMessage.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  senderId: id,
                  recipientId: id,
                  createdAt: { gt: messageCutoff(this.clock(), true) },
                },
                {
                  NOT: { senderId: id, recipientId: id },
                  createdAt: { gt: messageCutoff(this.clock()) },
                },
              ],
            },
          ],
          OR: [
            { senderId: id, hiddenBySender: false },
            { recipientId: id, hiddenByRecipient: false },
          ],
        },
        select: {
          id: true,
          senderId: true,
          recipientId: true,
          body: true,
          createdAt: true,
        },
        take: 10001,
      });
      if (
        messages.length > 10000 ||
        posts.length > 10000 ||
        photos.length > 10000
      )
        throw new SocialError(
          409,
          "This account needs an assisted export. Contact support@margin.social.",
        );
      const gallery = await tx.galleryEntry.findMany({
        where: { ownerId: id },
        select: { photoId: true, featured: true, position: true },
        orderBy: { position: "asc" },
      });
      const music = (
        await tx.profileSong.findMany({
          where: { userId: id },
          orderBy: { position: "asc" },
        })
      ).map(profileTrackFromRow);
      const comments = await tx.postComment.findMany({
        where: {
          authorId: id,
          post: { deletedAt: null, expiresAt: { gt: this.clock() } },
        },
        select: {
          id: true,
          postId: true,
          body: true,
          replyToId: true,
          createdAt: true,
        },
        take: 10001,
      });
      const likes = await tx.postLike.findMany({
        where: { userId: id },
        select: { postId: true, createdAt: true },
        take: 10001,
      });
      const friendships = await tx.friendship.findMany({
        where: { OR: [{ lowId: id }, { highId: id }] },
        take: 10001,
      });
      const blocked = await tx.block.findMany({
        where: { blockerId: id },
        select: { blockedId: true },
        take: 10001,
      });
      const reports = await tx.safetyReport.findMany({
        where: { reporterId: id },
        select: {
          id: true,
          reason: true,
          details: true,
          targetKind: true,
          targetId: true,
          status: true,
          createdAt: true,
        },
        take: 10001,
      });
      const notifications = await tx.memberNotification.findMany({
        where: { recipientId: id },
        select: {
          id: true,
          kind: true,
          actorId: true,
          postId: true,
          createdAt: true,
          readAt: true,
        },
        take: 10001,
      });
      if (
        [comments, likes, friendships, blocked, reports, notifications].some(
          (rows) => rows.length > 10000,
        )
      )
        throw new SocialError(
          409,
          "This account needs an assisted export. Contact support@margin.social.",
        );
      return {
        topFriends: await readTopFriends(tx, id),
        exportedAt: this.clock().toISOString(),
        profile,
        music,
        posts,
        photos,
        gallery,
        messages,
        comments,
        likes,
        friendships,
        blocked,
        reports,
        notifications,
      };
    });
  }
}
