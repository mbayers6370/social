import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/server/cache";

// Add named, reviewed policies rather than accepting limits supplied by a request.
const policies = { mutation: { requests: 10, window: "1 m" } } as const;
const limiters = new Map<keyof typeof policies, Ratelimit>();

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

/** Call after authentication using the verified session subject. Redis errors propagate (fail closed). */
export async function enforceRateLimit(
  policy: keyof typeof policies,
  subject: string,
) {
  if (!subject) throw new Error("A rate-limit subject is required");
  let limiter = limiters.get(policy);
  if (!limiter) {
    const rule = policies[policy];
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(rule.requests, rule.window),
      prefix: `social:ratelimit:${policy}`,
      analytics: false,
    });
    limiters.set(policy, limiter);
  }
  const result = await limiter.limit(subject);
  if (!result.success)
    throw new RateLimitError(
      Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    );
  return result;
}
