import { z } from "zod";

export const idSchema = z.cuid();
export const paginationSchema = z.strictObject({
  cursor: idSchema.optional(),
  take: z.coerce.number().int().min(1).max(100).default(25),
});
