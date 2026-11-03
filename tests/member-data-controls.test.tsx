import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberDataControls } from "@/features/social/member-data-controls";
const { archive } = vi.hoisted(() => ({
  archive: vi.fn(() => new Uint8Array([1])),
}));
vi.mock("fflate", () => ({
  zipSync: archive,
  strToU8: (value: string) => new TextEncoder().encode(value),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
const request = vi.fn();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => "blob:private-download");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());
it("exports only selected sections and never fetches photograph bytes for an excluded photograph section", async () => {
  request.mockResolvedValue(
    new Response(
      JSON.stringify({
        exportedAt: "2026-11-02T20:00:00Z",
        profile: {
          displayName: "Saved Member",
          username: "saved_member",
          bio: "Saved introduction",
          portraitPhotoId: null,
          notifyComments: true,
        },
        music: [],
        messages: [
          { senderId: "a", recipientId: "b", body: "PRIVATE_MESSAGE_CANARY" },
        ],
        photos: [{ id: "private-photo", description: "PRIVATE_PHOTO_CANARY" }],
        reports: [{ details: "PRIVATE_REPORT_CANARY" }],
      }),
    ),
  );
  const user = userEvent.setup();
  render(<MemberDataControls />);
  await user.click(screen.getByRole("button", { name: "Download your data" }));
  for (const checkbox of screen.getAllByRole("checkbox"))
    if (!checkbox.closest("label")?.textContent?.startsWith("Profile & music"))
      await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: "Prepare download" }));
  await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
  const files = archive.mock.calls[0] as unknown as [
    Record<string, Uint8Array>,
  ];
  const saved = new TextDecoder().decode(files[0]["account-data.json"]);
  expect(JSON.parse(saved).data).toEqual({
    profile: {
      displayName: "Saved Member",
      username: "saved_member",
      bio: "Saved introduction",
      portraitPhotoId: null,
      music: [],
    },
  });
  expect(saved).not.toMatch(/PRIVATE_.*CANARY|notifyComments/);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    "/api/member/export",
    expect.objectContaining({ cache: "no-store" }),
  );
});
