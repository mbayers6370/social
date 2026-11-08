import "server-only";
import {
  DEFAULT_PORTRAIT_CROP,
  readPortraitCrop,
  portraitCropSchema,
  portraitCropBounds,
  type PortraitCrop,
} from "@/lib/portrait-crop";
import { topFriendCandidates, saveTopFriends } from "./top-friends";
import sharp from "sharp";
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
} from "@/features/social/member-schema";
import type {
  MemberIdentity,
  MemberContact,
} from "@/features/social/member-contracts";
import { memberPostingWindow } from "@/server/social/posting-allowance";
import { SocialService } from "@/server/social/service";
import { active, unavailable } from "./selectors";

export class MemberProfileService extends SocialService {
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
        portraitCrop: readPortraitCrop(account.portraitCrop),
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

  async setPortrait(
    subject: string,
    photoId: string | null,
    framing: PortraitCrop = DEFAULT_PORTRAIT_CROP,
  ) {
    const crop = portraitCropSchema.parse(framing);
    await this.transaction(async (tx) => {
      const id = await this.actor(tx, subject);
      await this.lock(tx, [id]);
      const previous = await tx.account.findUniqueOrThrow({
        where: { userId: id },
        select: { portraitPhotoId: true },
      });
      if (
        photoId &&
        !(await tx.photo.findFirst({
          where: {
            id: photoId,
            ownerId: id,
            state: "READY",
            OR: [
              { gallery: { is: { ownerId: id } } },
              { portraits: { some: { userId: id } } },
            ],
          },
          select: { id: true },
        }))
      )
        throw unavailable();
      await tx.account.update({
        where: { userId: id },
        data: {
          portraitPhotoId: photoId,
          portraitCrop: photoId ? crop : DEFAULT_PORTRAIT_CROP,
        },
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
        select: {
          portraitCrop: true,
          portrait: { select: { objectKey: true, width: true, height: true } },
        },
      });
      if (!account?.portrait) throw unavailable();
      // Only the profile-sized crop is visible with a profile introduction. The
      // original remains behind its existing friends/Space media authorization.
      return sharp(await this.store.get(account.portrait.objectKey))
        .extract(
          portraitCropBounds(
            account.portrait.width,
            account.portrait.height,
            readPortraitCrop(account.portraitCrop),
          ),
        )
        .resize(208, 208)
        .webp({ quality: 85 })
        .toBuffer();
    });
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
              portraitCrop: true,
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
}
