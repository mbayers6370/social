import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { SiteHeader } from "@/components/layout/site-header";
import { ComponentExamples } from "./component-examples";
import { PostCardPreview } from "@/features/feed/post-card-preview";
import { PostContent } from "@/features/feed/post-content";
import { InkRule } from "@/components/ui/ink-rule";

export const metadata = {
  title: "Component workbench",
  robots: { index: false },
};

export default async function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { getDevelopmentFeed } = await import("@/server/fixtures/feed");
  const examplePost = getDevelopmentFeed().posts.find((post) => !post.media)!;
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Container className="space-y-12 py-14">
          <div className="max-w-reading space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight">
              Component workbench
            </h1>
            <p className="text-lg leading-8 text-muted-foreground">
              A local reference for shared controls, keyboard interactions, and
              form states. The form validates in memory and saves nothing.
            </p>
          </div>
          <section aria-labelledby="post-cards-title" className="space-y-6">
            <div className="max-w-reading space-y-3">
              <h2 id="post-cards-title" className="text-2xl font-semibold">
                Post cards
              </h2>
              <p className="text-muted-foreground">
                A sample post and its matching skeleton. Toggle the preview to
                compare the loaded and loading states.
              </p>
            </div>
            <PostCardPreview post={examplePost}>
              <PostContent post={examplePost} />
            </PostCardPreview>
          </section>
          <section aria-labelledby="ink-rules-title" className="space-y-6">
            <div className="max-w-reading space-y-3">
              <h2 id="ink-rules-title" className="text-2xl font-semibold">
                Ink Rules
              </h2>
              <p className="text-muted-foreground">
                Dry Ink, Ribbon, and Smudge. Each fills its container while
                preserving the ink grain and inherits the surrounding text
                color.
              </p>
            </div>
            {(["dry", "ribbon", "smudge"] as const).map((variant) => (
              <div key={variant} className="space-y-3">
                <p className="text-sm capitalize">
                  {variant === "dry" ? "Dry Ink" : variant}
                </p>
                <InkRule variant={variant} aria-label={`${variant} ink rule`} />
              </div>
            ))}
          </section>
          <ComponentExamples />
        </Container>
      </main>
    </>
  );
}
