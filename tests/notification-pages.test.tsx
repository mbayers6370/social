import { beforeEach, afterEach, expect, it, vi } from "vitest";
import AppPage from "@/app/app/page";
import SpacePage from "@/app/app/spaces/[id]/page";
import { sampleProfile } from "@/features/social/member-preview";
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  posts: vi.fn(),
  readSpace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/auth", () => ({
  requireUser: async () => "verified-subject",
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/server/social/service", () => ({
  SocialService: class {
    account = async () => ({ id: "viewer", accountStatus: "ACTIVE" });
    profile = mocks.profile;
  },
}));
vi.mock("@/server/spaces/pages", () => ({
  memberPage: async (
    load: (service: object, subject: string) => Promise<object>,
  ) => ({
    data: await load(
      { posts: mocks.posts, readSpace: mocks.readSpace },
      "verified-subject",
    ),
    error: null,
  }),
}));
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  mocks.profile.mockResolvedValue(sampleProfile);
  mocks.posts.mockResolvedValue({ posts: [], nextCursor: null });
  mocks.readSpace.mockResolvedValue({ viewerId: "viewer" });
});
afterEach(() => vi.unstubAllEnvs());
it("passes a validated personal post target through the verified profile read and existing presentation", async () => {
  const result = await AppPage({
    searchParams: Promise.resolve({
      person: "friend",
      post: "older-post",
      comment: "reply",
    }),
  });
  expect(mocks.profile).toHaveBeenCalledWith(
    "verified-subject",
    "friend",
    undefined,
    "older-post",
  );
  expect(result.props.conversationTarget).toEqual({
    postId: "older-post",
    commentId: "reply",
  });
});
it("passes a validated Space post anchor to its scoped server read", async () => {
  await SpacePage({
    params: Promise.resolve({ id: "private-space" }),
    searchParams: Promise.resolve({ post: "older-post", comment: "reply" }),
  });
  expect(mocks.readSpace).toHaveBeenCalledWith(
    "verified-subject",
    "private-space",
  );
  expect(mocks.posts).toHaveBeenCalledWith(
    "verified-subject",
    "private-space",
    undefined,
    "older-post",
  );
});
for (const query of [
  { comment: "orphan" },
  { post: "p", before: "other" },
  { post: ["p", "other"] },
  { post: "wrong/id" },
  { unknown: "p" },
]) {
  it(`rejects malformed or ambiguous target parameters: ${JSON.stringify(query)}`, async () => {
    await expect(
      AppPage({ searchParams: Promise.resolve(query) }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      SpacePage({
        params: Promise.resolve({ id: "space" }),
        searchParams: Promise.resolve(query),
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.posts).not.toHaveBeenCalled();
  });
}
