import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "@/app/app/feed/page";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getDb: vi.fn(),
  limit: vi.fn(),
  account: vi.fn(),
  feed: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/server/security/rate-limit", () => ({
  enforceRateLimit: mocks.limit,
}));
vi.mock("@/server/spaces/service", () => ({
  SpaceService: class {
    account = mocks.account;
    feed = mocks.feed;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("@/features/social/member-feed", () => ({
  MemberFeed: ({
    data,
    error,
  }: {
    data: { viewer: { name: string } } | null;
    error: string;
  }) => (data ? <h1>{data.viewer.name}</h1> : <p role="alert">{error}</p>),
}));

beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  mocks.requireUser.mockResolvedValue("verified-subject");
  mocks.account.mockResolvedValue({
    id: "internal-member",
    name: "Saved member",
    accountStatus: "ACTIVE",
  });
  mocks.feed.mockResolvedValue({
    posts: [],
    nextCursor: null,
    hasFriends: false,
  });
});
afterEach(() => vi.unstubAllEnvs());

it("passes the verified identity and actual member to the shared feed", async () => {
  render(
    await Page({ searchParams: Promise.resolve({ before: "saved-cursor" }) }),
  );
  expect(mocks.account).toHaveBeenCalledWith("verified-subject");
  expect(mocks.feed).toHaveBeenCalledWith("verified-subject", "saved-cursor");
  expect(screen.getByRole("heading", { name: "Saved member" })).toBeVisible();
});

it.each([null, { id: "pending", accountStatus: "PENDING" }])(
  "keeps missing or inactive accounts out of the feed: %j",
  async (account) => {
    mocks.account.mockResolvedValueOnce(account);
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.feed).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your account needs activation",
    );
  },
);

it("preserves sign-in redirects before database access", async () => {
  mocks.requireUser.mockRejectedValueOnce(Error("SIGN_IN_REDIRECT"));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "SIGN_IN_REDIRECT",
  );
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("handles unavailable reads without disclosing the internal error or sample identity", async () => {
  mocks.feed.mockRejectedValueOnce(Error("INTERNAL_DATABASE_CANARY"));
  render(await Page({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Your feed could not be loaded.",
  );
  expect(document.body).not.toHaveTextContent("CANARY");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("rejects malformed cursors before authentication or database access", async () => {
  await expect(
    Page({ searchParams: Promise.resolve({ before: "invalid?cursor" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.requireUser).not.toHaveBeenCalled();
  expect(mocks.getDb).not.toHaveBeenCalled();
});
