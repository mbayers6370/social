import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { getDevelopmentOrigins } from "./src/lib/development-hosts";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins:
    process.env.NODE_ENV === "development" ? getDevelopmentOrigins() : [],
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [1, 2, 3, 4, 5].map((number) => ({
      protocol: "https" as const,
      hostname: `is${number}-ssl.mzstatic.com`,
      pathname: "/image/thumb/**",
      search: "",
    })),
    maximumRedirects: 0,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
        deleteSourcemapsAfterUpload: true,
      },
    })
  : nextConfig;
