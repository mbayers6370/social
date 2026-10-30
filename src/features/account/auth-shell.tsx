import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLink } from "@/components/shared/brand-link";
export function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="margin-auth-page">
      <header>
        <BrandLink href="/welcome" />
      </header>
      <main id="main-content" tabIndex={-1} className="margin-auth-panel">
        <header>
          <div className="margin-auth-mobile-brand">
            <BrandLink href="/welcome" />
          </div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <div className="margin-auth-content">{children}</div>
        <footer>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help</Link>
        </footer>
      </main>
    </div>
  );
}
export const authAppearance = {
  elements: {
    rootBox: "margin-auth-provider",
    cardBox: "margin-auth-provider-card",
    card: "margin-auth-provider-inner",
    header: "sr-only",
    socialButtonsBlockButton: "margin-auth-social-button",
    footer: "margin-auth-provider-footer",
  },
};
