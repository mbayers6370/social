import "server-only";
import { z } from "zod";

// Validate only the service being used. A UI-only local session needs no cloud credentials.
const redisSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.url().startsWith("https://"),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});
const databaseSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((value) =>
      ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    ),
});
const storageSchema = z.object({
  R2_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

function readEnv<T extends z.ZodType>(schema: T): z.output<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Zod errors may contain supplied secret values. Report names only.
    throw new Error(
      `Missing or invalid server configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return result.data;
}

export const getRedisEnv = () => readEnv(redisSchema);
export const getStorageEnv = () => readEnv(storageSchema);
export const getDatabaseEnv = () => readEnv(databaseSchema);
