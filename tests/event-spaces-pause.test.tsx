import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({ read: vi.fn(), posts: vi.fn() }));
vi.mock("@/server/spaces/pages", () => ({
  memberPage: async (
    load: (service: unknown, subject: string) => Promise<unknown>,
  ) => ({
    data: await load({ readSpace: state.read, posts: state.posts }, "member"),
    error: null,
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("not-found");
  },
}));
vi.mock("@/components/layout/live-app-shell", () => ({
  LiveAppShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/spaces/space-details", () => ({
  SpaceDetails: () => <h1>Private Space</h1>,
}));
vi.mock("@/features/spaces/space-timeline", () => ({
  SpaceTimeline: () => null,
}));
import Page from "@/app/app/spaces/[id]/page";
beforeEach(() => {
  vi.clearAllMocks();
  state.posts.mockResolvedValue({ posts: [], nextCursor: null });
});
const page = () =>
  Page({
    params: Promise.resolve({ id: "joined-space" }),
    searchParams: Promise.resolve({}),
  });
it("does not expose joined Event details or load their posts through a direct member URL", async () => {
  state.read.mockResolvedValue({ id: "joined-space", kind: "EVENT" });
  await expect(page()).rejects.toThrow("not-found");
  expect(state.read).toHaveBeenCalledWith("member", "joined-space");
  expect(state.posts).not.toHaveBeenCalled();
});
it("keeps private Space member pages available", async () => {
  state.read.mockResolvedValue({ id: "joined-space", kind: "PRIVATE" });
  render(await page());
  expect(
    screen.getByRole("heading", { name: "Private Space" }),
  ).toBeInTheDocument();
  expect(state.posts).toHaveBeenCalledWith(
    "member",
    "joined-space",
    undefined,
    undefined,
  );
});
