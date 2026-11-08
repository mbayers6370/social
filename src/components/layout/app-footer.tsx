import Link from "next/link";
import { publicDemo } from "@/lib/public-demo";
import { publicFooterGroups } from "./footer-links";

/** Mobile utilities live in Settings; desktop retains a page footer. */
export function AppFooter({ desktop = false }: { desktop?: boolean }) {
  return (
    <footer
      className={
        desktop
          ? "margin-app-footer margin-app-footer-desktop"
          : "margin-app-footer"
      }
    >
      {desktop && <span>© 2026 margin</span>}
      <nav
        aria-label={
          desktop
            ? "Footer"
            : publicDemo
              ? "Demo information"
              : "Help and legal"
        }
      >
        {desktop && publicDemo ? (
          <>
            <Link href="/your-data/">Your data</Link>
            <Link href="/retention/">Retention</Link>
          </>
        ) : desktop ? (
          <>
            <Link href="/help">Help & safety</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </>
        ) : (
          publicFooterGroups.map((group) => (
            <section key={group.title} data-footer-group={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href}>
                      {href === "/help" ? "Help & safety" : label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>
    </footer>
  );
}
