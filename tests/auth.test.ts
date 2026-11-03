// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  user: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: sdk.auth,
  clerkClient: async () => ({
    sessions: { getSession: sdk.session },
    users: { getUser: sdk.user },
  }),
}));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: sdk.rate,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
}));
import {
  requireViewer,
  requireUser,
  requireAccountSession,
  UnauthorizedError,
  EmailVerificationRequiredError,
  AuthenticationUnavailableError,
} from "@/server/auth";
import { RateLimitError } from "@/server/security/rate-limit";
const active = () => ({
  id: "session-one",
  userId: "user-one",
  status: "active",
  expireAt: Date.now() + 3_600_000,
  abandonAt: Date.now() + 3_600_000,
});
const user = () => ({
  id: "user-one",
  banned: false,
  locked: false,
  primaryEmailAddressId: "email-one",
  emailAddresses: [
    {
      id: "email-one",
      emailAddress: "private@example.test",
      verification: { status: "verified" },
    },
  ],
});
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  sdk.auth.mockResolvedValue({ userId: "user-one", sessionId: "session-one" });
  sdk.session.mockResolvedValue(active());
  sdk.user.mockResolvedValue(user());
  sdk.rate.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.useRealTimers();
});
it("returns only a provider-verified subject after checking current session and verified email", async () => {
  expect(await requireViewer()).toEqual({ id: "user-one" });
  expect(sdk.session).toHaveBeenCalledWith("session-one");
  expect(sdk.user).toHaveBeenCalledWith("user-one");
  expect(sdk.rate).toHaveBeenCalledWith("authSession", "user-one");
});
it.each([
  { userId: null, sessionId: null },
  { userId: "user-one", sessionId: null },
])(
  "rejects missing session identity without backend lookup: %j",
  async (identity) => {
    sdk.auth.mockResolvedValue(identity);
    await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sdk.session).not.toHaveBeenCalled();
  },
);
it.each(["revoked", "ended", "expired", "abandoned", "pending"])(
  "denies a %s session even with a valid token subject",
  async (status) => {
    sdk.session.mockResolvedValue({ ...active(), status });
    await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
  },
);
it.each([
  { userId: "other" },
  { id: "other" },
  { expireAt: 1 },
  { abandonAt: 1 },
])("denies mismatched or expired current session state: %j", async (patch) => {
  sdk.session.mockResolvedValue({ ...active(), ...patch });
  await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
});
it.each([{ banned: true }, { locked: true }, { id: "other" }])(
  "rejects unavailable provider identities: %j",
  async (patch) => {
    sdk.user.mockResolvedValue({ ...user(), ...patch });
    await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
  },
);
it.each([
  { expireAt: undefined },
  { abandonAt: Number.NaN },
  { expireAt: -1 },
  { abandonAt: -1 },
])("fails closed on malformed provider deadlines: %j", async (patch) => {
  sdk.session.mockResolvedValue({ ...active(), ...patch });
  await expect(requireViewer()).rejects.toBeInstanceOf(
    AuthenticationUnavailableError,
  );
});
it("honors Clerk's zero-deadline contract only while the provider session is active", async () => {
  sdk.session.mockResolvedValue({ ...active(), expireAt: 0, abandonAt: 0 });
  expect(await requireViewer()).toEqual({ id: "user-one" });
  sdk.session.mockResolvedValue({
    ...active(),
    status: "revoked",
    expireAt: 0,
    abandonAt: 0,
  });
  await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
});
it("requires the primary verified email, but permits authenticated verification recovery", async () => {
  sdk.user.mockResolvedValue({
    ...user(),
    primaryEmailAddressId: "unverified",
  });
  await expect(requireViewer()).rejects.toBeInstanceOf(
    EmailVerificationRequiredError,
  );
  expect(
    (await requireAccountSession({ verifiedEmail: false })).verifiedEmail,
  ).toBeNull();
  await expect(requireUser()).rejects.toThrow("redirect:/onboarding");
});
it("redirects ended page sessions to a fixed internal sign-in destination", async () => {
  sdk.auth.mockResolvedValue({ userId: null });
  await expect(requireUser()).rejects.toThrow(
    "redirect:/sign-in?reason=session-ended",
  );
});
it("fails closed on provider failures without exposing service details", async () => {
  sdk.session.mockRejectedValue(new Error("PRIVATE_CREDENTIAL_CANARY"));
  await expect(requireViewer()).rejects.toEqual(
    new AuthenticationUnavailableError(),
  );
});
it("treats deleted sessions as signed out, not as a provider outage", async () => {
  sdk.session.mockRejectedValue({ status: 404 });
  await expect(requireViewer()).rejects.toBeInstanceOf(UnauthorizedError);
});
it("does not query Clerk when the shared abuse gate fails", async () => {
  sdk.rate.mockRejectedValue(new RateLimitError(60));
  await expect(requireViewer()).rejects.toBeInstanceOf(RateLimitError);
  expect(sdk.session).not.toHaveBeenCalled();
});
it("bounds authentication lookup time when a provider stalls", async () => {
  vi.useFakeTimers();
  sdk.session.mockReturnValue(new Promise(() => {}));
  const lookup = expect(requireViewer()).rejects.toBeInstanceOf(
    AuthenticationUnavailableError,
  );
  await vi.advanceTimersByTimeAsync(10_000);
  await lookup;
});
