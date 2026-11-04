import Link from "next/link";
import { ChevronRight } from "@/components/margin-icons";
import type { ReactNode } from "react";
import { PublicNavigation } from "./public-navigation";
export const publicHomeHref = () =>
  process.env.NODE_ENV === "development" ? "/welcome" : "/";
const groups = [
  {
    title: "Explore",
    links: [
      ["Why Margin", "/why-margin"],
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
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}
