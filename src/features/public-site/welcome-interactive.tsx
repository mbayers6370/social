"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, Conversation } from "@/components/margin-icons";

type DemoStage = "initial" | "invited" | "front" | "back";
const DemoContext = createContext<{
  stage: DemoStage;
  setStage: (stage: DemoStage) => void;
} | null>(null);

export function WelcomeDemo({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<DemoStage>("initial");
  return (
    <DemoContext.Provider value={{ stage, setStage }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useWelcomeDemo() {
  const value = useContext(DemoContext);
  if (!value) throw Error("Welcome demo controls require WelcomeDemo.");
  return value;
}

/** The product's card turn, using only a fictional public discussion. */
export function WelcomePost({
  children,
  discussion,
}: {
  children: ReactNode;
  discussion: ReactNode;
}) {
  const { stage, setStage } = useWelcomeDemo();
  const open = stage === "back";
  const setOpen = (value: boolean) => setStage(value ? "back" : "front");
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) back.current?.focus({ preventScroll: true });
    else if (wasOpen.current) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <article
      className="margin-welcome-post"
      aria-label="Post by Alex Rowan"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <div className="margin-welcome-post-turn" data-open={open}>
        <div
          className="margin-welcome-post-front"
          inert={open}
          aria-hidden={open}
        >
          {children}
          <button
            ref={trigger}
            type="button"
            className="margin-welcome-post-action"
            aria-label="Open conversation"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(true)}
          >
            <Conversation aria-hidden="true" />
            <span>Conversation</span>
          </button>
        </div>
        <div
          className="margin-welcome-post-back"
          id={id}
          inert={!open}
          aria-hidden={!open}
        >
          <header className="margin-welcome-conversation-heading">
            <button
              ref={back}
              type="button"
              className="margin-welcome-conversation-back"
              aria-label="Close conversation"
              onClick={() => setOpen(false)}
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <span>Conversation</span>
          </header>
          {discussion}
        </div>
      </div>
    </article>
  );
}
