import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { accountConfiguration } from "@/server/account/config";
import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import {
  clerkAppearance,
  clerkLocalization,
} from "@/features/account/clerk-appearance";
import { MobileViewport } from "@/components/shared/mobile-viewport";
import { AccountSession } from "@/components/auth/account-session";
import "@/styles/globals.css";
import "@/styles/application.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const hinge = localFont({
  src: [
    {
      path: "../../public/fonts/margin/margin-hinge-light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/margin/margin-hinge-medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/margin/margin-hinge-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-hinge",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
// A per-request nonce cannot be baked into cached HTML.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "margin", template: "%s · margin" },
  description: "A considered space for people and ideas.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { configured } = accountConfiguration();
  const content = (
    <>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-background px-4 py-3 focus:not-sr-only"
      >
        Skip to content
      </a>
      {children}
    </>
  );
  return (
    <html lang="en" className={`${inter.variable} ${hinge.variable}`}>
      <body>
        <MobileViewport />
        {configured ? (
          <ClerkProvider
            ui={ui}
            dynamic
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInForceRedirectUrl="/onboarding"
            signUpForceRedirectUrl="/onboarding"
            afterSignOutUrl="/welcome"
            appearance={clerkAppearance}
            localization={clerkLocalization}
          >
            <AccountSession enabled>{content}</AccountSession>
          </ClerkProvider>
        ) : (
          <AccountSession
            enabled={false}
            previewAllowed={process.env.NODE_ENV === "development"}
          >
            {content}
          </AccountSession>
        )}
      </body>
    </html>
  );
}
