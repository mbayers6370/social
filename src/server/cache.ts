import "server-only";
import { Redis } from "@upstash/redis";
import { getRedisEnv } from "@/server/env";

let redis: Redis | undefined;

export function getRedis() {
  const env = getRedisEnv();
  return (redis ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  }));
}
