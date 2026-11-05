import "server-only";
import { SocialError } from "@/server/social/errors";
import { memberPerson } from "@/lib/member-person";
import { memberMessageInput } from "@/features/social/member-schema";
import type {
  MemberConversation,
  MemberThread,
} from "@/features/social/member-contracts";
import { Prisma } from "@/generated/prisma/client";
import { messageCutoff } from "@/lib/message-policy";
import { SocialService } from "@/server/social/service";
import { active, accountSelect, unavailable, pair } from "./selectors";

export class MemberMessageService extends SocialService {
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
}
