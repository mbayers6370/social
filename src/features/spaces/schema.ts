import { z } from "zod";
export const resourceId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const timeZone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.");
export const spaceInput = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("PRIVATE"),
    name: z.string().trim().min(1).max(100),
  }),
  z.strictObject({
    kind: z.literal("GATHERING"),
    name: z.string().trim().min(1).max(100),
    startsAt: z.iso.datetime(),
    timeZone,
    location: z.string().trim().max(300).optional(),
  }),
]);
export const memberInput = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("preferences"),
    includeInFeed: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("rsvp"),
    rsvp: z.enum(["GOING", "MAYBE", "DECLINED"]).nullable(),
  }),
  z.strictObject({
    action: z.literal("role"),
    userId: resourceId,
    role: z.enum(["ADMIN", "MEMBER"]),
  }),
  z.strictObject({ action: z.literal("remove"), userId: resourceId }),
]);
export const spacePostDraftInput = z.strictObject({
  body: z.string().trim().max(2000),
  photoIds: z.array(resourceId).max(3).default([]),
});
export const spacePostInput = spacePostDraftInput.refine(
  (v) => v.body.length > 0 || v.photoIds.length > 0,
  "Write a post or choose a photograph.",
);
export const commentInput = z.strictObject({
  body: z.string().trim().min(1).max(2000),
  replyTo: resourceId.optional(),
});
export type SpaceInput = z.infer<typeof spaceInput>;
export const eventJoinInput = z.strictObject({});
export const eventScheduleInput = z.strictObject({ endsAt: z.iso.datetime() });
export type MemberInput = z.infer<typeof memberInput>;

export const spaceInvitationSearch = z
  .string()
  .trim()
  .max(80)
  .transform((value) => value.replace(/^@/, ""))
  .refine(
    (value) => value.length === 0 || value.length >= 2,
    "Enter at least two characters.",
  );
