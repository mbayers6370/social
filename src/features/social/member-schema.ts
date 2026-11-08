import { portraitCropSchema } from "@/lib/portrait-crop";
import { z } from "zod";
import { profileInputSchema } from "@/features/profile/schema";
import { usernameSchema } from "@/features/profile/username";
import { validTimeZone } from "@/lib/posting-day";
export const memberId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const memberProfileInput = profileInputSchema;
export const memberUsernameInput = z.strictObject({ username: usernameSchema });
export const memberPortraitInput = z.strictObject({
  photoId: memberId.nullable(),
  crop: portraitCropSchema.optional(),
});
export const memberPreferencesInput = z
  .strictObject({
    postingTimeZone: z
      .string()
      .min(1)
      .max(100)
      .refine(validTimeZone, "Choose a valid IANA time zone.")
      .optional(),
    readingSize: z.enum(["standard", "larger", "extra-large"]).optional(),
    motion: z.enum(["system", "reduced"]).optional(),
    notifyComments: z.boolean().optional(),
    notifyLikes: z.boolean().optional(),
    notifyFriends: z.boolean().optional(),
    notifyMessages: z.boolean().optional(),
    messagingEnabled: z.boolean().optional(),
    showTopFriends: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Choose a setting to change.",
  );
export const memberGalleryInput = z
  .strictObject({
    version: z.number().int().nonnegative(),
    deletedPhotoIds: z.array(memberId).max(20).default([]),
    entries: z
      .array(z.strictObject({ photoId: memberId, featured: z.boolean() }))
      .max(20),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.entries.map((entry) => entry.photoId)).size !==
        value.entries.length ||
      value.entries.filter((entry) => entry.featured).length > 3
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose each photograph once, with up to three featured.",
      });
  });
export const memberMessageInput = z.strictObject({
  body: z.string().trim().min(1).max(2000),
  requestId: z.string().uuid(),
});
export const memberReadInput = z.strictObject({ through: memberId.optional() });
export const memberNotificationInput = z.strictObject({
  id: memberId.optional(),
});
export const memberLikeInput = z.strictObject({ liked: z.boolean() });
export const memberPostDraftInput = z
  .strictObject({
    body: z.string().trim().max(3000),
    photoIds: z.array(memberId).max(3).default([]),
  })
  .refine(
    (value) => new Set(value.photoIds).size === value.photoIds.length,
    "Choose each photograph once.",
  );

export const memberTopFriendsInput = z.strictObject({
  friendIds: z
    .array(memberId)
    .max(4)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Choose each friend only once.",
    ),
  requestId: z.string().uuid(),
});
