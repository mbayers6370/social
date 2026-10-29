import { z } from "zod";

export const imageSchema = z.strictObject({
  src: z
    .string()
    .regex(/^\/_next\/static\/media\/[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
});

export const personSchema = z.strictObject({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  initials: z.string().min(1).max(3),
  tone: z.enum(["paper", "sage", "sand"]),
  photo: imageSchema.optional(),
});
export const commentSchema = z.strictObject({
  id: z.string().min(1).max(100),
  author: personSchema,
  body: z.string().min(1).max(2000),
  createdAt: z.iso.datetime(),
  replyTo: z.string().max(100).optional(),
});
export const commentInputSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, "Write a thought before posting.")
    .max(2000, "Keep your comment to 2,000 characters."),
});
export const postMediaSchema = z.strictObject({
  description: z.string().max(300),
  caption: z.string().max(200),
  aspect: z.enum(["landscape", "portrait"]),
  image: imageSchema,
});
export type PostMedia = z.infer<typeof postMediaSchema>;
export const postSchema = z.strictObject({
  id: z.string().regex(/^post-[a-z0-9-]+$/),
  author: personSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  paragraphs: z.array(z.string().min(1).max(3000)).min(1).max(8),
  media: z.array(postMediaSchema).min(1).max(3).optional(),
  link: z
    .strictObject({
      title: z.string().max(200),
      url: z.url().startsWith("https://"),
    })
    .optional(),
  likes: z.number().int().min(0),
  comments: z.array(commentSchema).max(100),
});
export type Person = z.infer<typeof personSchema>;
export type FeedPost = z.infer<typeof postSchema>;
export type FeedComment = z.infer<typeof commentSchema>;
export type CommentInput = z.infer<typeof commentInputSchema>;
