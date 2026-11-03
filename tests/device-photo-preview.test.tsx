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

it("keeps the selected file readable until replacement or unmount and preserves alt text", () => {
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:second");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
  const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
  const { rerender, unmount } = render(
    <DevicePhotoPreview file={first} description="A morning walk" />,
  );
  expect(screen.getByRole("img", { name: "A morning walk" })).toHaveAttribute(
    "src",
    "blob:first",
  );
  rerender(
    <DevicePhotoPreview file={first} description="A walk by the river" />,
  );
  expect(create).toHaveBeenCalledTimes(1);
  expect(revoke).not.toHaveBeenCalled();
  rerender(<DevicePhotoPreview file={second} description="An evening walk" />);
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:first");
  expect(screen.getByRole("img", { name: "An evening walk" })).toHaveAttribute(
    "src",
    "blob:second",
  );
  unmount();
  expect(revoke).toHaveBeenLastCalledWith("blob:second");
});

it("explains an unreadable image and recovers when a different file is selected", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selected");
  const first = new File(["invalid"], "first.jpg", { type: "image/jpeg" });
  const { rerender } = render(
    <DevicePhotoPreview file={first} description="" />,
  );
  fireEvent.error(screen.getByRole("img", { name: "Selected photograph" }));
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be previewed");
  const second = new File(["replacement"], "second.jpg", {
    type: "image/jpeg",
  });
  rerender(<DevicePhotoPreview file={second} description="A replacement" />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "A replacement" })).toBeVisible();
});
