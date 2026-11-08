import { PublicHome } from "@/features/public-site/public-home";
import { PortfolioShell } from "@/features/public-demo/public-shell";
export const metadata = { alternates: { canonical: "/" } };
export default function Page() {
  return (
    <PortfolioShell>
      <PublicHome portfolio />
    </PortfolioShell>
  );
}
