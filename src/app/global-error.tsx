"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import "@/styles/globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN)
      void import("@sentry/nextjs").then((Sentry) =>
        Sentry.captureException(error),
      );
  }, [error]);
  return (
    <html lang="en">
      <body>
        <main
          id="main-content"
          className="mx-auto max-w-reading space-y-5 px-6 py-24"
        >
          <h1 className="text-3xl font-semibold">This page couldn’t load.</h1>
          <p>Try loading the page again.</p>
          <Button onClick={retry}>Try again</Button>
        </main>
      </body>
    </html>
  );
}
