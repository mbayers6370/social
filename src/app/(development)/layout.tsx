import type { ReactNode } from "react";
import { DevelopmentEnvironment } from "@/features/local-preview/development-environment";
export default function Layout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") return children;
  return <DevelopmentEnvironment>{children}</DevelopmentEnvironment>;
}
