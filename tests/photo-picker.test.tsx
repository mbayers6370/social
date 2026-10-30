import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider } from "@/features/local-preview/provider";
import { PhotoPicker } from "@/features/gallery/photo-picker";
import { notificationFixture } from "./helpers/notification-fixture";

it("keeps the native file control accessible and identifies a chosen or replaced photograph without submitting it", async () => {
  const user = userEvent.setup();
  const choose = vi.fn();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <PhotoPicker open onOpenChange={vi.fn()} onChoose={choose} />
    </PreviewProvider>,
  );
  const dialog = screen.getByRole("dialog", { name: "Choose a photograph" });
  const input = within(dialog).getByLabelText(
    "Photograph from your device",
  ) as HTMLInputElement;
  expect(input).toHaveAttribute("type", "file");
  expect(input).not.toHaveAttribute("tabindex", "-1");
  expect(within(dialog).getByText("Choose photograph")).toBeInTheDocument();
  const first = new File(["local preview"], "morning-walk.png", {
    type: "image/png",
  });
  await user.upload(input, first);
  expect(input.files?.[0]).toBe(first);
  expect(within(dialog).getByRole("status")).toHaveTextContent(
    "morning-walk.png",
  );
  expect(within(dialog).getByText("Change photograph")).toBeInTheDocument();
  const replacement = new File(["replacement"], "quiet-afternoon.webp", {
    type: "image/webp",
  });
  await user.upload(input, replacement);
  expect(within(dialog).getByRole("status")).toHaveTextContent(
    "quiet-afternoon.webp",
  );
  expect(choose).not.toHaveBeenCalled();
});

it("uses a compact footer associated with the upload form, explains alt text, and cancels without choosing a photograph", async () => {
  const user = userEvent.setup();
  const onChoose = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <PhotoPicker
        open
        context="gallery"
        onOpenChange={onOpenChange}
        onChoose={onChoose}
      />
    </PreviewProvider>,
  );
  const dialog = screen.getByRole("dialog", { name: "Choose a photograph" });
  expect(dialog).toHaveClass(
    "margin-photo-picker",
    "margin-photo-picker-gallery",
  );
  const input = within(dialog).getByRole("textbox", {
    name: "Describe the photograph (alt text)",
  });
  expect(input).toHaveAccessibleDescription(
    "Describe what’s visible for people using screen readers. Add any story in your post.",
  );
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  const submit = within(dialog).getByRole("button", {
    name: "Use Photograph",
  }) as HTMLButtonElement;
  expect(cancel.parentElement).toBe(submit.parentElement);
  expect(submit.parentElement).toHaveClass("margin-photo-picker-footer");
  expect(submit.form).toBe(input.closest("form"));
  expect(submit).toHaveAttribute("type", "submit");
  expect(
    within(dialog).getByText(/Adding here does not use a post slot/),
  ).toHaveAttribute("role", "status");
  await user.click(cancel);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(onChoose).not.toHaveBeenCalled();
});

it("shows a deliberate selection and preserves a reused photograph’s saved description", async () => {
  const { previewBootstrap } = await import("./helpers/local-preview-fixture");
  const data = previewBootstrap();
  const user = userEvent.setup();
  const choose = vi.fn();
  render(
    <PreviewProvider bootstrap={data}>
      <PhotoPicker open onOpenChange={vi.fn()} onChoose={choose} />
    </PreviewProvider>,
  );
  const use = screen.getByRole("button", { name: "Use Photograph" });
  expect(use).toBeDisabled();
  const morning = screen.getByRole("button", { name: "Select Morning" });
  await user.click(morning);
  expect(morning).toHaveAttribute("aria-pressed", "true");
  expect(morning.querySelector(".margin-photo-selected-mark")).not.toBeNull();
  const description = screen.getByRole("textbox", {
    name: "Describe the photograph (alt text)",
  });
  expect(description).toHaveValue("Morning photograph");
  expect(description).toHaveAttribute("readonly");
  expect(use).toBeEnabled();
  expect(choose).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Select Coffee" }));
  expect(morning).toHaveAttribute("aria-pressed", "false");
  expect(description).toHaveValue("Coffee photograph");
  await user.click(use);
  expect(choose).toHaveBeenCalledWith(data.photos[2]);
});
it("clears the saved description when switching to a new file and restores it on reuse", async () => {
  const { previewBootstrap } = await import("./helpers/local-preview-fixture");
  const user = userEvent.setup();
  const choose = vi.fn();
  render(
    <PreviewProvider bootstrap={previewBootstrap()}>
      <PhotoPicker open onOpenChange={vi.fn()} onChoose={choose} />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Select Morning" }));
  const description = screen.getByRole("textbox", {
    name: "Describe the photograph (alt text)",
  });
  await user.upload(
    screen.getByLabelText("Photograph from your device"),
    new File(["photo"], "new.png", { type: "image/png" }),
  );
  expect(description).toHaveValue("");
  expect(description).not.toHaveAttribute("readonly");
  expect(
    screen.getByRole("button", { name: "Select Morning" }),
  ).toHaveAttribute("aria-pressed", "false");
  await user.type(description, "The new view");
  await user.click(screen.getByRole("button", { name: "Select Morning" }));
  expect(description).toHaveValue("Morning photograph");
  expect(
    (screen.getByLabelText("Photograph from your device") as HTMLInputElement)
      .value,
  ).toBe("");
  expect(choose).not.toHaveBeenCalled();
});
