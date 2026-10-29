"use client";
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  moveGalleryEntries,
  type GalleryEntry,
} from "@/features/local-preview/model";

type Box = { left: number; top: number; width: number; height: number };
type Session = {
  id: string;
  pointer: number;
  handle: HTMLButtonElement;
  x: number;
  y: number;
  startX: number;
  startY: number;
  touch: boolean;
  moved: boolean;
  settling: boolean;
  target: string | null;
  viewportTop: number;
  boxes: Map<string, Box>;
  animation?: Animation;
};
type Lift = {
  id: string;
  target: string | null;
  width: number;
  height: number;
  boxes: Map<string, Box>;
};
function release(session: Session) {
  if (session.handle.hasPointerCapture?.(session.pointer))
    session.handle.releasePointerCapture(session.pointer);
}
const ordered = (entries: GalleryEntry[]) =>
  [true, false].flatMap((featured) =>
    entries.filter((entry) => entry.featured === featured),
  );
const reducedMotion = () =>
  document.documentElement.dataset.motion === "reduced" ||
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Keep the actual cells stable during preview: touch capture survives featured-row exchanges. */
export function useGalleryDrag(
  entries: GalleryEntry[],
  move: (id: string, target: string) => void,
) {
  const stage = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const active = useRef<Session | null>(null);
  const frame = useRef<number | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  const moveRef = useRef(move);
  useLayoutEffect(() => {
    moveRef.current = move;
  });
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const cell = [
      ...(stage.current?.querySelectorAll<HTMLElement>(
        "[data-gallery-photo]",
      ) ?? []),
    ].find((item) => item.dataset.galleryPhoto === pendingFocus.current);
    cell
      ?.querySelector<HTMLButtonElement>(".margin-gallery-drag")
      ?.focus({ preventScroll: true });
    pendingFocus.current = null;
  });
  const clear = useCallback(() => {
    const session = active.current;
    active.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    session?.animation?.cancel();
    if (session) release(session);
    setLift(null);
  }, []);
  function update(session: Session) {
    if (active.current !== session || session.settling) return;
    const tile =
      session.y >= session.viewportTop
        ? [...session.boxes].find(([, box]) => {
            const x = session.x + window.scrollX;
            const y = session.y + window.scrollY;
            return (
              x >= box.left &&
              x <= box.left + box.width &&
              y >= box.top &&
              y <= box.top + box.height
            );
          })
        : undefined;
    // Hit-test the original slots, not moving photographs: the destination stays stable.
    const target = tile?.[0] ?? null;
    session.target = target;
    setLift((current) =>
      current && current.target !== target ? { ...current, target } : current,
    );
    if (ghost.current) {
      const width = Math.min(
        session.boxes.get(session.id)!.width,
        session.touch ? 112 : 160,
      );
      const x = Math.max(
        8,
        Math.min(session.x - width / 2, window.innerWidth - width - 8),
      );
      const y = Math.max(8, session.y - width - (session.touch ? 24 : 16));
      ghost.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }
  function tick() {
    frame.current = null;
    const session = active.current;
    if (!session?.moved || session.settling) return;
    const edge = 64;
    const speed =
      session.y < session.viewportTop + edge
        ? -12
        : session.y > window.innerHeight - edge
          ? 12
          : 0;
    if (speed) window.scrollBy({ top: speed, behavior: "instant" });
    update(session);
    frame.current = requestAnimationFrame(tick);
  }
  useLayoutEffect(() => {
    const session = active.current;
    if (session?.moved && !session.settling) update(session);
  }, [lift?.id]);
  useEffect(() => {
    function cancel() {
      clear();
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && active.current) {
        event.preventDefault();
        clear();
      }
    }
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
      const session = active.current;
      active.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      session?.animation?.cancel();
      if (session) release(session);
    };
  }, [clear]);
  // An external edit invalidates the measured slots; never commit a stale drag.
  const signature = entries
    .map((entry) => `${entry.photoId}:${entry.featured}`)
    .join("|");
  useEffect(() => {
    if (active.current) clear();
  }, [signature, clear]);
  function finish(session: Session) {
    if (active.current !== session) return;
    const target = session.target;
    if (target && target !== session.id) {
      pendingFocus.current = session.id;
      moveRef.current(session.id, target);
    }
    clear();
  }
  const slots = ordered(entries);
  const projection =
    lift?.target &&
    entries.some((entry) => entry.photoId === lift.id) &&
    entries.some((entry) => entry.photoId === lift.target)
      ? ordered(moveGalleryEntries(entries, lift.id, lift.target))
      : slots;
  return {
    stage,
    ghost,
    lift,
    cancel: clear,
    position(id: string): CSSProperties | undefined {
      if (!lift) return;
      const from = lift.boxes.get(id);
      const destination =
        slots[projection.findIndex((entry) => entry.photoId === id)]?.photoId;
      const to = destination ? lift.boxes.get(destination) : undefined;
      if (!from || !to || !from.width || !from.height) return;
      return {
        transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
      };
    },
    handle(id: string) {
      return {
        onPointerDown(event: PointerEvent<HTMLButtonElement>) {
          if (!event.isPrimary || event.button !== 0 || active.current) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          const boxes = new Map<string, Box>();
          stage.current
            ?.querySelectorAll<HTMLElement>("[data-gallery-photo]")
            .forEach((cell) => {
              const rect = cell.getBoundingClientRect();
              boxes.set(cell.dataset.galleryPhoto!, {
                left: rect.left + window.scrollX,
                top: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height,
              });
            });
          if (!boxes.get(id)?.width) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const header = document.querySelector<HTMLElement>(".margin-header");
          active.current = {
            id,
            pointer: event.pointerId,
            handle: event.currentTarget,
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            touch: event.pointerType === "touch",
            moved: false,
            settling: false,
            target: id,
            viewportTop:
              header && getComputedStyle(header).position === "sticky"
                ? Math.max(0, header.getBoundingClientRect().bottom)
                : 0,
            boxes,
          };
        },
        onPointerMove(event: PointerEvent<HTMLButtonElement>) {
          const session = active.current;
          if (
            !session ||
            session.pointer !== event.pointerId ||
            session.settling
          )
            return;
          session.x = event.clientX;
          session.y = event.clientY;
          if (!session.moved) {
            if (
              Math.hypot(
                session.x - session.startX,
                session.y - session.startY,
              ) < 6
            )
              return;
            session.moved = true;
            const box = session.boxes.get(id)!;
            const width = Math.min(box.width, session.touch ? 112 : 160);
            setLift({
              id,
              target: id,
              width,
              height: (width * box.height) / (box.width || 1),
              boxes: session.boxes,
            });
            frame.current = requestAnimationFrame(tick);
          }
          update(session);
        },
        onPointerUp(event: PointerEvent<HTMLButtonElement>) {
          const session = active.current;
          if (
            !session ||
            session.pointer !== event.pointerId ||
            session.settling
          )
            return;
          session.x = event.clientX;
          session.y = event.clientY;
          if (!session.moved) {
            clear();
            return;
          }
          update(session);
          if (!session.target || session.target === id) {
            clear();
            return;
          }
          session.settling = true;
          release(session);
          const to = session.boxes.get(session.target)!;
          const node = ghost.current;
          if (!node?.animate || reducedMotion()) {
            finish(session);
            return;
          }
          const scale =
            to.width /
            Math.min(session.boxes.get(id)!.width, session.touch ? 112 : 160);
          session.animation = node.animate(
            [
              { transform: node.style.transform },
              {
                transform: `translate3d(${to.left - window.scrollX}px, ${to.top - window.scrollY}px, 0) scale(${scale})`,
              },
            ],
            {
              duration: 160,
              easing: "cubic-bezier(.2,.7,.2,1)",
              fill: "forwards",
            },
          );
          void session.animation.finished.then(
            () => finish(session),
            () => {},
          );
        },
        onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
          if (
            active.current?.pointer === event.pointerId &&
            !active.current.settling
          )
            clear();
        },
        onLostPointerCapture(event: PointerEvent<HTMLButtonElement>) {
          if (
            active.current?.pointer === event.pointerId &&
            !active.current.settling
          )
            clear();
        },
        onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
          if (event.key === "Escape") {
            clear();
            return;
          }
          if (active.current) return;
          const step = ["ArrowLeft", "ArrowUp"].includes(event.key)
            ? -1
            : ["ArrowRight", "ArrowDown"].includes(event.key)
              ? 1
              : 0;
          if (!step) return;
          event.preventDefault();
          const next =
            slots[slots.findIndex((entry) => entry.photoId === id) + step];
          if (next) {
            pendingFocus.current = id;
            moveRef.current(id, next.photoId);
          }
        },
      };
    },
  };
}
