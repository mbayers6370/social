"use client";
import { createContext, useContext } from "react";

export type Session = {
  loginSessionId: string | null;
  ready: boolean;
  available: boolean;
  signedIn: boolean;
  managed: boolean;
  enterPreview: () => void;
  leave: () => Promise<void>;
  manage: () => void | Promise<void>;
};
export const AccountSessionContext = createContext<Session | null>(null);
export function useAccountSession() {
  return useContext(AccountSessionContext);
}
