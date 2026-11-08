"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { previewHref, publicDemo } from "@/lib/public-demo";

export function usePreviewRouter() {
  const router = useRouter();
  return useMemo(
    () =>
      publicDemo
        ? {
            ...router,
            push: (href: string, options?: Parameters<typeof router.push>[1]) =>
              router.push(previewHref(href), options),
            replace: (
              href: string,
              options?: Parameters<typeof router.replace>[1],
            ) => router.replace(previewHref(href), options),
          }
        : router,
    [router],
  );
}
