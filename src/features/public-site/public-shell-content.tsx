import Link from "next/link";
import { ChevronRight } from "@/components/margin-icons";
import type { ReactNode } from "react";
import { publicDemo } from "@/lib/public-demo";
import { publicFooterGroups } from "@/components/layout/footer-links";
export function PublicFooter() {
  return (
    <footer className="margin-public-footer margin-navigation-theme">
      <div className="margin-public-footer-inner">
        <nav
          className="margin-public-footer-groups"
          aria-label="Footer"
          data-demo-footer={publicDemo || undefined}
        >
          {publicFooterGroups.map((group) => (
            <div key={group.title} data-footer-group={group.title}>
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
        <div className="margin-public-footer-bottom">
          <span>© 2026 margin</span>
          <span>A little less, a little closer.</span>
        </div>
      </div>
    </footer>
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
  const Component = href.startsWith("#") ? "a" : Link;
  return (
    <Component href={href} className="margin-public-text-link" {...props}>
      {children}
      <ChevronRight aria-hidden="true" />
    </Component>
  );
}
