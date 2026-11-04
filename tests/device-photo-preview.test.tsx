import { expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DevicePhotoPreview } from "@/components/shared/device-photo-preview";

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn();
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the selected file readable until replacement or unmount without a description field", () => {
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:second");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
  const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
  const { rerender, unmount } = render(<DevicePhotoPreview file={first} />);
  expect(
    screen.getByRole("img", { name: "Selected photograph" }),
  ).toHaveAttribute("src", "blob:first");
  rerender(<DevicePhotoPreview file={first} />);
  expect(create).toHaveBeenCalledTimes(1);
  expect(revoke).not.toHaveBeenCalled();
  rerender(<DevicePhotoPreview file={second} />);
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:first");
  expect(
    screen.getByRole("img", { name: "Selected photograph" }),
  ).toHaveAttribute("src", "blob:second");
  unmount();
  expect(revoke).toHaveBeenLastCalledWith("blob:second");
});

it("explains an unreadable image and recovers when a different file is selected", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selected");
  const first = new File(["invalid"], "first.jpg", { type: "image/jpeg" });
  const { rerender } = render(<DevicePhotoPreview file={first} />);
  fireEvent.error(screen.getByRole("img", { name: "Selected photograph" }));
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be previewed");
  const second = new File(["replacement"], "second.jpg", {
    type: "image/jpeg",
  });
  rerender(<DevicePhotoPreview file={second} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Selected photograph" }),
  ).toBeVisible();
});
