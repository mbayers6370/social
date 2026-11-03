import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLink } from "@/components/shared/brand-link";
export function AuthShell({
  title,
  intro,
  children,
  providerHeading = false,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  providerHeading?: boolean;
}) {
  return (
    <div className="margin-auth-page">
      <header>
        <BrandLink href="/welcome" />
      </header>
      <main id="main-content" tabIndex={-1} className="margin-auth-panel">
        <header
          className={providerHeading ? "margin-auth-provider-brand" : undefined}
        >
          <div className="margin-auth-mobile-brand">
            <BrandLink href="/welcome" />
          </div>
          {!providerHeading && (
            <>
              <h1>{title}</h1>
              <p>{intro}</p>
            </>
          )}
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
