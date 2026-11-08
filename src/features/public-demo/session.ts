"use client";
import { createContext, useContext } from "react";

/** Provided only by the public demo. The production account menu has no demo session. */
export const DemoExitContext = createContext<(() => void) | null>(null);
export function useDemoExit() {
  return useContext(DemoExitContext);
}
