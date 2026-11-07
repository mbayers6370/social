"use client";
import type { SpaceClient } from "@/features/spaces/client";
import { memberIdentitySchema, type MemberIdentity } from "./member-contracts";
export class MemberRequestError extends Error {
  readonly status: number;
  readonly uncertain: boolean;
  constructor(message: string, status: number, uncertain = false) {
    super(message);
    this.status = status;
    this.uncertain = uncertain;
  }
}
/** Reuses the app's authenticated HTTP transport; fixture transports supply no
 * identity or authorization and cannot bypass any real API handler. */
export async function requestMember<T>(
  client: SpaceClient,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await client.request(url, {
      cache: "no-store",
      ...init,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
  } catch {
    throw new MemberRequestError(
      "Couldn’t reach Margin. Your draft is still here. Please try again.",
      0,
      !["GET", "HEAD"].includes(init.method ?? "GET"),
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new MemberRequestError(
      typeof data?.error === "string"
        ? data.error
        : "This change could not be completed. Please try again.",
      response.status,
      response.status >= 500 && !["GET", "HEAD"].includes(init.method ?? "GET"),
    );
  return data as T;
}
/** An unreadable success must never replace the last valid account state. */
export async function requestMemberIdentity(
  client: SpaceClient,
  url: string,
  init: RequestInit = {},
): Promise<MemberIdentity> {
  const data = await requestMember<unknown>(client, url, init);
  const identity = memberIdentitySchema.safeParse(data);
  if (!identity.success)
    throw new MemberRequestError(
      "Margin returned an incomplete account response. Please try again.",
      502,
      !["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase()),
    );
  return identity.data;
}
export const memberJson = (method: string, value: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
export function memberChanged() {
  window.dispatchEvent(new Event("margin:member-updated"));
}
