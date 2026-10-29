import { z } from "zod";
import { personSchema } from "@/features/feed/schema";

export const messageInputSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(2000, "Keep your message to 2,000 characters."),
});
const messageSchema = z.strictObject({
  id: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  direction: z.enum(["incoming", "outgoing"]),
  createdAt: z.iso.datetime(),
});
export const threadSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  contact: personSchema,
  unread: z.boolean(),
  messages: z.array(messageSchema).max(100),
});
export type PreviewThread = z.infer<typeof threadSchema>;
export type PreviewMessage = PreviewThread["messages"][number];
export type MessageInput = z.infer<typeof messageInputSchema>;
