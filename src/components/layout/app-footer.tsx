import Link from "next/link";

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
      <nav aria-label={desktop ? "Footer" : "Help and legal"}>
        <Link href="/help">Help & safety</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
      {!desktop && <span>© 2026 margin</span>}
    </footer>
  );
}
