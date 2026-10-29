import type { ReactNode } from "react";
import { PublicShell } from "@/features/public-site/public-shell";
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
