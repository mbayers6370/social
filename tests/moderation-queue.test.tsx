import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ModerationQueue } from "@/features/safety/moderation-queue";
import { SpaceClientProvider } from "@/features/spaces/client";

vi.mock("@/components/layout/live-app-shell", () => ({
  LiveAppShell: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));
it("requires an explicit review confirmation and preserves the reason after a failed decision", async () => {
  const user = userEvent.setup();
  const request = vi.fn(async () =>
    Response.json({ error: "Try again" }, { status: 503 }),
  );
  render(
    <SpaceClientProvider
      client={{
        request,
        href: (path) => path,
        photoSrc: (id) => `/api/photos/${id}`,
        preview: false,
      }}
    >
      <ModerationQueue
        initial={[
          {
            id: "report",
            targetKind: "post",
            targetId: "post",
            reason: "harmful",
            details: "A report",
            status: "RECEIVED",
            createdAt: "2026-11-03T12:00:00Z",
            review: null,
          },
        ]}
        initialCursor={null}
      />
    </SpaceClientProvider>,
  );
  await user.click(screen.getByText("post · harmful · RECEIVED"));
  const button = screen.getByRole("button", { name: "Record decision" });
  expect(button).toBeDisabled();
  await user.type(
    screen.getByRole("textbox", { name: "Decision reason" }),
    "Reviewed the reported item",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  expect(screen.getByRole("textbox", { name: "Decision reason" })).toHaveValue(
    "Reviewed the reported item",
  );
  expect(request).toHaveBeenCalledTimes(1);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Disposition" }),
    "REMOVE_POST",
  );
  expect(button).toBeDisabled();
});
