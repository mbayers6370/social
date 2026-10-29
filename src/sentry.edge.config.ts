import * as Sentry from "@sentry/nextjs";
import { monitoringOptions } from "@/lib/monitoring/options";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    ...monitoringOptions,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
}
