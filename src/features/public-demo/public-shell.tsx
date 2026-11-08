import Link from "next/link";
import { BrandLink } from "@/components/shared/brand-link";
import { ScrollHeader } from "@/components/layout/scroll-header";
import { PublicFooter } from "@/features/public-site/public-shell-content";
export function PortfolioShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="margin-public-site">
      <ScrollHeader className="margin-public-header margin-topbar margin-navigation-theme">
        <BrandLink href="/" label="margin home" animate />
        <nav aria-label="Public navigation" className="margin-public-primary">
          <Link href="/why-margin/" className="margin-public-information">
            Why Margin
          </Link>
          <Link href="/how-it-works/" className="margin-public-information">
            How it works
          </Link>
          <Link href="/demo/" className="margin-public-join">
            Explore Demo
          </Link>
        </nav>
      </ScrollHeader>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
