import { z } from "zod";

const resourceId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const moderationDecision = z
  .strictObject({
    action: z.enum([
      "DISMISS",
      "REMOVE_POST",
      "REMOVE_MESSAGE",
      "REMOVE_PHOTO",
      "DEACTIVATE_ACCOUNT",
    ]),
    note: z.string().trim().min(1).max(1000),
    photoId: resourceId.optional(),
  })
  .refine(
    (input) =>
      input.action === "REMOVE_PHOTO"
        ? Boolean(input.photoId)
        : input.photoId === undefined,
    {
      message: "A photo ID is required only for photo removal",
      path: ["photoId"],
    },
  );
export const eventAdminAssignment = z.strictObject({
  userId: resourceId,
  role: z.enum(["ADMIN", "MEMBER"]),
  note: z.string().trim().min(1).max(1000),
});
