import { render, screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { GalleryPage } from "@/features/gallery/gallery-page";
import { previewBootstrap as bootstrap } from "./helpers/local-preview-fixture";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

function prepareGalleryDrag() {
  class Pointer extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "touch";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  vi.stubGlobal("PointerEvent", Pointer);
  document
    .querySelectorAll<HTMLElement>("[data-gallery-photo]")
    .forEach((cell, index) => {
      const rect =
        index < 3
          ? new DOMRect(index * 110, 100, 100, 100)
          : new DOMRect(0, 220, 150, 150);
      cell.getBoundingClientRect = () => rect;
      const handle = cell.querySelector<HTMLButtonElement>(
        ".margin-gallery-drag",
      )!;
      handle.setPointerCapture = vi.fn();
      handle.releasePointerCapture = vi.fn();
      handle.hasPointerCapture = () => true;
    });
}

it("opens photographs without filenames, and arranges three featured slots with explicit controls", async () => {
  const user = userEvent.setup();
  const data = bootstrap();
  data.photos[0] = {
    ...data.photos[0],
    kind: "local",
    title: "private-file-name.jpg",
  };
  render(
    <PreviewProvider bootstrap={data}>
      <GalleryPage />
    </PreviewProvider>,
  );
  expect(screen.getByRole("heading", { name: "Your Gallery" })).toBeVisible();
  expect(screen.queryByText(/From a post/)).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", {
      name: "View Morning photograph, photograph 1 of 4",
    }),
  );
  const viewer = screen.getByRole("dialog", { name: "Photograph" });
  expect(viewer).toHaveTextContent("Morning photograph");
  expect(document.body).not.toHaveTextContent("private-file-name.jpg");
  expect(
    within(viewer).getByRole("button", { name: "Previous photograph" }),
  ).toBeDisabled();
  await user.click(
    within(viewer).getByRole("button", { name: "Next photograph" }),
  );
  expect(viewer).toHaveTextContent("Architecture");
  await user.keyboard("{ArrowLeft}");
  expect(viewer).toHaveTextContent("Morning photograph");
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", {
      name: "Select Architecture, photograph 2 of 4",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Move earlier" }));
  expect(
    screen.getByRole("button", {
      name: "Select Architecture, photograph 1 of 4",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await user.click(
    screen.getByRole("button", { name: "Select Evening, photograph 4 of 4" }),
  );
  const feature = screen.getByRole("button", { name: "Feature photograph" });
  expect(feature).toBeDisabled();
  await user.click(feature);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const handle = screen.getByRole("button", { name: "Move Evening" });
  handle.focus();
  await user.keyboard("{ArrowLeft}");
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: /Select Evening/ }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Evening" })).toHaveFocus();
});

it("previews a touch exchange without committing, cancels safely, and places instantly with reduced motion", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const handle = screen.getByRole("button", { name: "Move Evening" });
  const original = handle.closest<HTMLElement>("[data-gallery-photo]")!;
  const displaced = screen
    .getByRole("button", { name: "Move Morning" })
    .closest<HTMLElement>("[data-gallery-photo]")!;
  const start = () => {
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 300, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 50, clientY: 150 });
  };
  for (const cancel of [
    () => fireEvent.pointerCancel(handle),
    () => fireEvent.lostPointerCapture(handle),
    () => fireEvent.keyDown(window, { key: "Escape" }),
    () => fireEvent(window, new Event("resize")),
  ]) {
    start();
    expect(document.querySelector(".margin-gallery-floating")).toHaveStyle({
      width: "112px",
    });
    expect(document.querySelector(".margin-gallery-floating")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(original).toHaveAttribute("data-lifted", "true");
    expect(original.style.transform).toContain("translate(0px, -120px)");
    expect(displaced.style.transform).toBe(
      "translate(0px, 120px) scale(1.5, 1.5)",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "destination 1 of 4, featured",
    );
    expect(
      within(
        screen.getByRole("region", { name: "More photographs" }),
      ).getByRole("button", { name: /Select Evening/ }),
    ).toBeVisible();
    cancel();
    expect(document.querySelector(".margin-gallery-floating")).toBeNull();
    expect(original.style.transform).toBe("");
  }
  start();
  fireEvent.pointerMove(handle, { clientX: 700, clientY: 450 });
  fireEvent.pointerUp(handle, { clientX: 700, clientY: 450 });
  expect(
    within(screen.getByRole("region", { name: "More photographs" })).getByRole(
      "button",
      { name: /Select Evening/ },
    ),
  ).toBeVisible();
  start();
  const ghost = document.querySelector<HTMLElement>(
    ".margin-gallery-floating",
  )!;
  ghost.animate = vi.fn();
  fireEvent.pointerUp(handle, { clientX: 50, clientY: 150 });
  expect(ghost.animate).not.toHaveBeenCalled();
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: /Select Evening, photograph 1 of 4/ }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Evening" })).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Moved Evening to photograph 1 of 4, featured.",
  );
});

it("opens a same-row insertion space and settles the desktop preview before committing", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  const handle = screen.getByRole("button", { name: "Move Morning" });
  fireEvent.pointerDown(handle, {
    clientX: 60,
    clientY: 160,
    pointerType: "mouse",
  });
  fireEvent.pointerMove(handle, {
    clientX: 270,
    clientY: 150,
    pointerType: "mouse",
  });
  const architecture = screen
    .getByRole("button", { name: "Move Architecture" })
    .closest<HTMLElement>("[data-gallery-photo]")!;
  expect(architecture.style.transform).toBe(
    "translate(-110px, 0px) scale(1, 1)",
  );
  expect(screen.getByRole("status")).toHaveTextContent("destination 3 of 4");
  const ghost = document.querySelector<HTMLElement>(
    ".margin-gallery-floating",
  )!;
  let settle!: () => void;
  const finished = new Promise<void>((resolve) => {
    settle = resolve;
  });
  ghost.animate = vi.fn(
    () => ({ finished, cancel: vi.fn() }) as unknown as Animation,
  );
  fireEvent.pointerUp(handle, { clientX: 270, clientY: 150 });
  expect(ghost.animate).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({ duration: 160 }),
  );
  fireEvent.lostPointerCapture(handle);
  expect(
    screen.getByRole("button", { name: "Select Morning, photograph 1 of 4" }),
  ).toBeVisible();
  await act(async () => {
    settle();
    await finished;
  });
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Select Morning, photograph 3 of 4" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Morning" })).toHaveFocus();
});

it("does not drop a gallery photograph into a slot obscured by the editor header", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <header className="margin-header" style={{ position: "sticky" }} />
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  document.querySelector<HTMLElement>(
    ".margin-gallery-editor-scroll",
  )!.getBoundingClientRect = () => new DOMRect(0, 84, 1280, 500);
  const first = screen
    .getByRole("button", { name: "Move Morning" })
    .closest<HTMLElement>("[data-gallery-photo]")!;
  first.getBoundingClientRect = () => new DOMRect(0, 20, 100, 100);
  const handle = screen.getByRole("button", { name: "Move Evening" });
  fireEvent.pointerDown(handle, { clientX: 50, clientY: 300 });
  fireEvent.pointerMove(handle, { clientX: 50, clientY: 50 });
  fireEvent.pointerUp(handle, { clientX: 50, clientY: 50 });
  expect(
    within(screen.getByRole("region", { name: "More photographs" })).getByRole(
      "button",
      { name: /Select Evening/ },
    ),
  ).toBeVisible();
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
});

it("scrolls near the viewport edge and stops its drag loop when the gallery unmounts", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  const frames: FrameRequestCallback[] = [];
  const request = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  const handle = screen.getByRole("button", { name: "Move Evening" });
  fireEvent.pointerDown(handle, { clientX: 50, clientY: 300 });
  fireEvent.pointerMove(handle, {
    clientX: 50,
    clientY: window.innerHeight - 10,
  });
  act(() => frames[0](0));
  expect(
    document.querySelector<HTMLElement>(".margin-gallery-editor-scroll")!
      .scrollTop,
  ).toBe(12);
  expect(scroll).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(2);
  unmount();
  expect(cancel).toHaveBeenCalledWith(2);
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
  act(() => frames[1](16));
  expect(request).toHaveBeenCalledTimes(2);
});

it("drops a photograph into an empty featured slot inside the editor", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", { name: "Select Morning, photograph 1 of 4" }),
  );
  await user.click(screen.getByRole("button", { name: "Unfeature" }));
  expect(
    screen.getByRole("button", { name: "Feature photograph" }),
  ).toBeEnabled();
  prepareGalleryDrag();
  document.querySelector<HTMLElement>(
    ".margin-gallery-editor-scroll",
  )!.getBoundingClientRect = () => new DOMRect(0, 0, 600, 500);
  document.querySelector<HTMLElement>(
    "[data-gallery-empty-feature]",
  )!.getBoundingClientRect = () => new DOMRect(400, 100, 100, 100);
  const handle = screen.getByRole("button", { name: "Move Evening" });
  fireEvent.pointerDown(handle, { clientX: 50, clientY: 270 });
  fireEvent.pointerMove(handle, { clientX: 450, clientY: 150 });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Feature Evening on the profile",
  );
  fireEvent.pointerUp(handle, { clientX: 450, clientY: 150 });
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: "Select Evening, photograph 3 of 4" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Evening" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Unfeature" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: "View Evening, photograph 3 of 4" }),
  ).toBeVisible();
});
