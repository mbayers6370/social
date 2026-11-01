import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { PublicHomeLink } from "./public-home-link";
import { publicSiteDetails } from "./site-details";
export const publicHomeHref = () =>
  process.env.NODE_ENV === "development" ? "/welcome" : "/";
const groups = [
  {
    title: "Explore",
    links: [
      ["Why margin", "/why-margin"],
      ["How it works", "/how-it-works"],
      ["About", "/why-margin#about"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help", "/help"],
      ["Contact", "/contact"],
      ["Community Guidelines", "/community-guidelines"],
      ["Accessibility", "/accessibility"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Copyright", "/copyright"],
      ["Your data", "/your-data"],
      ["Retention", "/retention"],
      ["Cookies", "/cookies"],
    ],
  },
];
function PublicLinks({ label }: { label: string }) {
  return (
    <nav aria-label={label} className="margin-public-primary">
      <Link href="/why-margin" className="margin-public-information">
        Why margin
      </Link>
      <Link href="/how-it-works" className="margin-public-information">
        How it works
      </Link>
      <Link href="/sign-in" className="margin-public-sign-in">
        Sign in
      </Link>
      <Link href="/sign-up" className="margin-public-join">
        {publicSiteDetails.joiningLabel}
      </Link>
    </nav>
  );
}
export function PublicFooter() {
  return (
    <footer className="margin-public-footer">
      <div className="margin-public-footer-inner">
        <nav
          className="margin-public-footer-groups margin-navigation-theme"
          aria-label="Footer"
        >
          {groups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map(([title, href]) => (
                  <li key={href}>
                    <Link href={href}>{title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="margin-public-footer-bottom margin-navigation-theme">
          <span>© 2026 margin</span>
          <span>A little less, a little closer.</span>
        </div>
      </div>
    </footer>
  );
}
export function PublicHeader() {
  return (
    <header className="margin-public-header margin-topbar margin-navigation-theme">
      <PublicHomeLink signedOutHref={publicHomeHref()} />
      <PublicLinks label="Public navigation" />
    </header>
  );
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
export function PublicTextLink({
  href,
  children,
  ...props
}: {
  href: string;
  children: ReactNode;
  "aria-describedby"?: string;
}) {
  return (
    <Link href={href} className="margin-public-text-link" {...props}>
      {children}
      <ChevronRight aria-hidden="true" strokeWidth={1.5} />
    </Link>
  );
}
