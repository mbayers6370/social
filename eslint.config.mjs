import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".local/**",
    "src/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/**",
                "@/generated/**",
                "@prisma/*",
                "@aws-sdk/*",
                "@upstash/*",
                "@clerk/nextjs/server",
              ],
              message:
                "Keep infrastructure and business logic behind src/server. Compose server data in an app route and pass serializable props to UI.",
            },
          ],
        },
      ],
    },
  },
]);
