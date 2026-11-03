import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import Page from "@/app/app/messages/page";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  threads: vi.fn(),
  conversation: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  requireUser: async () => "verified-subject",
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/server/member/service", () => ({
  MemberService: class {
    identity = mocks.identity;
    threads = mocks.threads;
    conversation = mocks.conversation;
  },
}));
vi.mock("@/components/layout/live-app-shell", () => ({
  LiveAppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/social/member-messages", () => ({
  MemberMessages: () => <h1>Available conversations</h1>,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  mocks.identity.mockResolvedValue({
    preferences: { messagingEnabled: false },
  });
  mocks.threads.mockResolvedValue({
    threads: [{ id: "friend" }],
    nextCursor: null,
  });
  mocks.conversation.mockResolvedValue({
    thread: { id: "friend" },
    messages: [],
    nextCursor: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
it("does not load any conversation data for a direct link while messaging is off", async () => {
  render(await Page({ searchParams: Promise.resolve({ thread: "friend" }) }));
  expect(mocks.identity).toHaveBeenCalledWith("verified-subject");
  expect(mocks.threads).not.toHaveBeenCalled();
  expect(mocks.conversation).not.toHaveBeenCalled();
  expect(
    screen.getByRole("heading", { name: "Messaging is off." }),
  ).toBeVisible();
});
it("returns to the existing member conversation flow after messaging is enabled", async () => {
  mocks.identity.mockResolvedValueOnce({
    preferences: { messagingEnabled: true },
  });
  render(await Page({ searchParams: Promise.resolve({ thread: "friend" }) }));
  expect(mocks.threads).toHaveBeenCalledWith("verified-subject");
  expect(mocks.conversation).toHaveBeenCalledWith("verified-subject", "friend");
  expect(
    screen.getByRole("heading", { name: "Available conversations" }),
  ).toBeVisible();
});
it("handles preference-service failure without attempting to load private messages", async () => {
  mocks.identity.mockRejectedValueOnce(Error("PRIVATE_INTERNAL_ERROR"));
  render(await Page({ searchParams: Promise.resolve({ thread: "friend" }) }));
  expect(mocks.threads).not.toHaveBeenCalled();
  expect(mocks.conversation).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Messages could not be loaded",
  );
  expect(document.body).not.toHaveTextContent("PRIVATE_INTERNAL_ERROR");
});
