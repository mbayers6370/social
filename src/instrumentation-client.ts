import { monitoringOptions } from "@/lib/monitoring/options";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({
      ...monitoringOptions,
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    }),
  );
}
