import type { ReactNode } from "react";
import { PublicNavigation } from "./public-navigation";
import { PublicFooter } from "./public-shell-content";
export { PublicFooter, PublicTextLink } from "./public-shell-content";
export const publicHomeHref = () =>
  process.env.NODE_ENV === "development" ? "/welcome" : "/";
export function PublicHeader() {
  return <PublicNavigation homeHref={publicHomeHref()} />;
}
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="margin-public-site">
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
