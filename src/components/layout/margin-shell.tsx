import type { ReactNode } from "react";
import { AppFooter } from "@/components/layout/app-footer";
import { MarginNavigation } from "@/components/layout/margin-navigation";
import type { MarginView } from "@/components/layout/margin-navigation";

export function MarginShell({
  children,
  active = "feed",
  profileAvatar,
  beforeNavigation,
}: {
  children: ReactNode;
  active?: MarginView;
  profileAvatar: ReactNode;
  beforeNavigation?: ReactNode;
}) {
  return (
    <div className="margin-app">
      {beforeNavigation}
      <MarginNavigation active={active} profileAvatar={profileAvatar} />
      <main id="main-content" tabIndex={-1} className="margin-main">
        {children}
      </main>
      <AppFooter desktop />
    </div>
  );
}
