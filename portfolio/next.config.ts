import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "export",
  experimental: { externalDir: true },
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_MARGIN_DEMO: "1" },
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  turbopack: { root: path.resolve(__dirname, "..") },
  webpack(config, { webpack }) {
    // Fail at build time if presentation imports reach application infrastructure.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /.*/,
        (resource: { request: string; context?: string }) => {
          const resolved = path.resolve(
            resource.context ?? __dirname,
            resource.request,
          );
          const backend = ["src/server", "src/generated"].some((directory) =>
            resolved.startsWith(
              path.resolve(__dirname, "..", directory) + path.sep,
            ),
          );
          if (
            backend ||
            /(?:@\/(?:server|generated)\/|@clerk\/|@prisma\/|@aws-sdk\/|@upstash\/|@sentry\/)/.test(
              resource.request,
            )
          )
            throw new Error(
              `Backend dependency is forbidden in the portfolio target: ${resource.request}`,
            );
        },
      ),
    );
    return config;
  },
};
export default config;
