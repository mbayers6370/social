import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/server/cache";

// Add named, reviewed policies rather than accepting limits supplied by a request.
const policies = {
  authSession: { requests: 120, window: "1 m" },
  onboarding: { requests: 5, window: "1 m" },
  ticketmasterBurst: { requests: 4, window: "1 s" },
  ticketmasterDay: { requests: 4000, window: "1 d" },
  spaceWrite: { requests: 20, window: "1 m" },
  read: { requests: 60, window: "1 m" },
  media: { requests: 120, window: "1 m" },
  mutation: { requests: 10, window: "1 m" },
  messageWrite: { requests: 30, window: "1 m" },
  musicSearch: { requests: 20, window: "1 m" },
  accountExport: { requests: 2, window: "1 m" },
  invitation: { requests: 20, window: "1 m" },
  invitationEmailGlobal: { requests: 60, window: "1 h" },
  invitationEmailLink: { requests: 5, window: "1 m" },
  invitationEmailAddress: { requests: 3, window: "1 d" },
} as const;
const limiters = new Map<keyof typeof policies, Ratelimit>();

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

/** Use a verified subject for account operations; invitation verification uses a fixed shared anonymous gate. Redis errors fail closed. */
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
  // Upstash's default timeout returns success:true; it is not an access grant.
  if (result.reason === "timeout")
    throw new Error("Rate-limit service unavailable");
  if (!result.success)
    throw new RateLimitError(
      Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    );
  return result;
}
