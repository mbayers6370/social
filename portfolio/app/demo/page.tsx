import { Suspense } from "react";
import { DemoExperience } from "@/features/public-demo/experience";
import { demoBootstrap } from "@/fixtures/demo";
export const metadata = {
  title: "Explore the demo",
  description:
    "Experience Margin as Ines, a fictional member. Posts, conversations and preferences stay in your browser tab.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/demo/" },
};
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main-content">
          <p>Opening the fictional demo…</p>
        </main>
      }
    >
      <DemoExperience bootstrap={demoBootstrap()} />
    </Suspense>
  );
}
