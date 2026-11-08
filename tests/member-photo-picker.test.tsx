import { expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberPhotoPicker } from "@/features/social/member-photo-picker";
import { SpaceClientProvider } from "@/features/spaces/client";
import { DEFAULT_PORTRAIT_CROP } from "@/lib/portrait-crop";

const photo = {
  id: "saved-photo",
  description: "Seaside",
  width: 800,
  height: 400,
};
const request = vi.fn(async () => Response.json(photo));
const client = {
  request,
  href: (url: string) => url,
  photoSrc: (id: string) => `/api/photos/${id}`,
  preview: false,
};
afterEach(() => vi.restoreAllMocks());

it("pairs gallery actions in the footer and uses the shared branded native input", async () => {
  const choose = vi.fn();
  const close = vi.fn();
  const user = userEvent.setup();
  render(
    <SpaceClientProvider client={client}>
      <MemberPhotoPicker
        open
        onOpenChange={close}
        photos={[]}
        onChoose={choose}
      />
    </SpaceClientProvider>,
  );
  const input = screen.getByLabelText("Photograph") as HTMLInputElement;
  expect(input).toHaveClass("margin-upload-native");
  expect(screen.getByText("Choose photograph")).toHaveClass(
    "margin-upload-choose",
  );
  const submit = screen.getByRole("button", {
    name: "Upload photograph",
  }) as HTMLButtonElement;
  const cancel = screen.getByRole("button", { name: "Cancel" });
  expect(submit.parentElement).toBe(cancel.parentElement);
  expect(submit.form).toBe(input.closest("form"));
  expect(submit).toBeDisabled();
  await user.click(cancel);
  expect(close).toHaveBeenCalledWith(false);
  expect(choose).not.toHaveBeenCalled();
});

it("restores saved framing, allows keyboard adjustment, and saves the crop rather than another upload", async () => {
  const choose = vi.fn();
  const close = vi.fn();
  const user = userEvent.setup();
  render(
    <SpaceClientProvider client={client}>
      <MemberPhotoPicker
        open
        portrait
        currentPortraitId={photo.id}
        currentCrop={{ x: 0.3, y: 0.5, zoom: 2 }}
        photos={[photo]}
        onOpenChange={close}
        onChoose={choose}
      />
    </SpaceClientProvider>,
  );
  const save = screen.getByRole("button", { name: "Use photograph" });
  expect(save).toBeDisabled();
  fireEvent.load(
    screen.getByRole("img", { name: "Profile photograph framing preview" }),
  );
  expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue("2");
  const horizontal = screen.getByRole("slider", {
    name: "Horizontal position",
  });
  horizontal.focus();
  fireEvent.change(horizontal, { target: { value: "0.8" } });
  await user.click(save);
  expect(choose).toHaveBeenCalledWith(photo, { x: 0.8, y: 0.5, zoom: 2 });
  expect(close).toHaveBeenCalledWith(false);
});

it("keeps saving disabled if the original cannot load, and can choose another photograph", async () => {
  const choose = vi.fn();
  const user = userEvent.setup();
  render(
    <MemberPhotoPicker
      open
      portrait
      currentPortraitId={photo.id}
      photos={[photo]}
      onOpenChange={vi.fn()}
      onChoose={choose}
    />,
  );
  fireEvent.error(
    screen.getByRole("img", { name: "Profile photograph framing preview" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be loaded");
  expect(screen.getByRole("button", { name: "Use photograph" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Choose another photograph" }),
  );
  expect(screen.getByLabelText("Photograph")).toBeInTheDocument();
  expect(choose).not.toHaveBeenCalled();
});

it("discards unsaved framing on cancel and reopens the current portrait even outside the gallery", async () => {
  const choose = vi.fn();
  const close = vi.fn();
  const view = (open: boolean) => (
    <MemberPhotoPicker
      open={open}
      portrait
      currentPhoto={photo}
      currentPortraitId={photo.id}
      photos={[]}
      currentCrop={DEFAULT_PORTRAIT_CROP}
      onOpenChange={close}
      onChoose={choose}
    />
  );
  const { rerender } = render(view(true));
  fireEvent.load(
    screen.getByRole("img", { name: "Profile photograph framing preview" }),
  );
  fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  rerender(view(false));
  rerender(view(true));
  expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue("1");
  expect(choose).not.toHaveBeenCalled();
});
