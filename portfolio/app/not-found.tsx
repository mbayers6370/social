import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PortfolioShell } from "@/features/public-demo/public-shell";

export default function NotFound() {
  return (
    <PortfolioShell>
      <section
        className="margin-demo-unavailable"
        aria-labelledby="demo-unavailable-title"
      >
        <h1 id="demo-unavailable-title">This page isn’t part of the demo.</h1>
        <p>Margin’s member application is preserved separately.</p>
        <div className="margin-demo-unavailable-actions">
          <Button asChild size="lg">
            <Link href="/demo/">Explore Demo</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Back to Margin</Link>
          </Button>
        </div>
      </section>
    </PortfolioShell>
  );
}
