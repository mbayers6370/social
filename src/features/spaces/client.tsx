"use client";
import { createContext, useContext, type ReactNode } from "react";

/** Explicit UI ports; the default always uses the authenticated HTTP boundary. */
export type SpaceClient = {
  request: (url: string, init?: RequestInit) => Promise<Response>;
  href: (url: string) => string;
  photoSrc: (id: string) => string;
  preview: boolean;
};
const liveClient: SpaceClient = {
  request: (url, init) => fetch(url, init),
  href: (url) => url,
  photoSrc: (id) => `/api/photos/${id}`,
  preview: false,
};
const Context = createContext(liveClient);
export function SpaceClientProvider({
  client,
  children,
}: {
  client: SpaceClient;
  children: ReactNode;
}) {
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
export const useSpaceClient = () => useContext(Context);
