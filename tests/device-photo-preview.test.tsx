import { expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DevicePhotoPreview } from "@/components/shared/device-photo-preview";
import { StrictMode } from "react";

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

it("renders only the generated blob URL when the filename contains HTML", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:opaque-photo");
  const file = new File(
    ["photo"],
    '\"><img src="https://service.invalid/leak" onerror="alert(1)">.jpg',
    { type: "image/jpeg" },
  );
  const { container } = render(<DevicePhotoPreview file={file} />);
  const image = screen.getByRole("img", { name: "Selected photograph" });
  expect(image).toHaveAttribute("src", "blob:opaque-photo");
  expect(image).not.toHaveAttribute("onerror");
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector("script")).toBeNull();
});

it("releases every acquired URL during Strict Mode mounting and final unmount", () => {
  let sequence = 0;
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockImplementation(() => `blob:strict-${++sequence}`);
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  const { unmount } = render(
    <StrictMode>
      <DevicePhotoPreview file={file} />
    </StrictMode>,
  );
  expect(
    screen.getByRole("img", { name: "Selected photograph" }),
  ).toHaveAttribute("src", create.mock.results.at(-1)!.value);
  unmount();
  expect(revoke.mock.calls.map(([url]) => url).sort()).toEqual(
    create.mock.results.map(({ value }) => value).sort(),
  );
});
