"use client";
import { createRequestId } from "@/lib/local-id";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { useSpaceClient } from "@/features/spaces/client";
import type { MemberIdentity } from "./member-contracts";
import { requestMember } from "./member-client";

const Context = createContext<{
  identity: MemberIdentity;
  profileEditRequested: boolean;
  requestProfileEdit: () => void;
  finishProfileEditRequest: () => void;
  notificationSeen: RefObject<Set<string>>;
  acceptIdentity: (identity: MemberIdentity) => void;
  reload: () => Promise<void>;
  messageDrafts: Record<string, string>;
  messageAttempt: (id: string, body: string) => { id: string; body: string };
  clearMessageAttempt: (id: string) => void;
  updateMessageDraft: (id: string, body: string) => void;
} | null>(null);
export const useMember = () => useContext(Context);
export function MemberProvider({
  initial,
  children,
}: {
  initial: MemberIdentity;
  children: ReactNode;
}) {
  const client = useSpaceClient();
  const [identity, setIdentity] = useState(initial);
  const [profileEditRequested, setProfileEditRequested] = useState(false);
  const requestProfileEdit = useCallback(
    () => setProfileEditRequested(true),
    [],
  );
  const finishProfileEditRequest = useCallback(
    () => setProfileEditRequested(false),
    [],
  );
  const notificationSeen = useRef(new Set<string>());
  const messageAttempts = useRef<Record<string, { id: string; body: string }>>(
    {},
  );
  const messageAttempt = useCallback((id: string, body: string) => {
    const previous = messageAttempts.current[id];
    if (previous && previous.body !== body)
      throw Error(
        "The previous delivery is uncertain. Retry that unchanged draft before sending a different message.",
      );
    return (messageAttempts.current[id] ??= { id: createRequestId(), body });
  }, []);
  const clearMessageAttempt = useCallback((id: string) => {
    delete messageAttempts.current[id];
  }, []);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(
    {},
  );
  const updateMessageDraft = useCallback(
    (id: string, body: string) =>
      setMessageDrafts((current) => ({ ...current, [id]: body })),
    [],
  );
  const reload = useCallback(async () => {
    setIdentity(
      await requestMember<MemberIdentity>(client, "/api/member/context"),
    );
  }, [client]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        void reload().catch(() => undefined);
    };
    window.addEventListener("margin:member-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("margin:member-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  useEffect(() => {
    const root = document.documentElement;
    const size = root.getAttribute("data-reading-size");
    const motion = root.getAttribute("data-motion");
    root.setAttribute("data-reading-size", identity.preferences.readingSize);
    root.setAttribute("data-motion", identity.preferences.motion);
    return () => {
      if (size === null) root.removeAttribute("data-reading-size");
      else root.setAttribute("data-reading-size", size);
      if (motion === null) root.removeAttribute("data-motion");
      else root.setAttribute("data-motion", motion);
    };
  }, [identity.preferences.readingSize, identity.preferences.motion]);
  return (
    <Context.Provider
      value={{
        identity,
        profileEditRequested,
        requestProfileEdit,
        finishProfileEditRequest,
        notificationSeen,
        acceptIdentity: setIdentity,
        reload,
        messageDrafts,
        messageAttempt,
        clearMessageAttempt,
        updateMessageDraft,
      }}
    >
      {children}
    </Context.Provider>
  );
}
