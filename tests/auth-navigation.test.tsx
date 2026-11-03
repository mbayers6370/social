import { expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { ApplicationNavigation } from "@/components/layout/application-navigation";
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a {...props} data-prefetch={String(prefetch)} />
  ),
}));
it("never background-prefetches member destinations through the authentication boundary", () => {
  const { container } = render(
    <ApplicationNavigation
      live
      active="profile"
      headerActions={null}
      mobileProfile={<span>Member</span>}
    />,
  );
  const links = container.querySelectorAll('a[href^="/app"]');
  expect(links.length).toBeGreaterThan(5);
  for (const link of links)
    expect(link).toHaveAttribute("data-prefetch", "false");
});
