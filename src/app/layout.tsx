import type { Metadata } from "next";
import { Caudex, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AccountSession } from "@/components/auth/account-session";
import "@/styles/globals.css";
import "@/styles/application.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const caudex = Caudex({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-caudex",
  display: "swap",
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
  let content = (
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
  if (process.env.NODE_ENV === "development") {
    const { PreviewProvider } =
      await import("@/features/local-preview/provider");
    const { getDevelopmentSocial } = await import("@/server/fixtures/social");
    const { loadDevelopmentFriendProfile } =
      await import("@/server/fixtures/friend-profile-action");
    const bootstrap = getDevelopmentSocial();
    bootstrap.profiles = bootstrap.profiles.map((profile) =>
      profile.person.id === bootstrap.viewerId
        ? { ...profile, onRepeat: [] }
        : profile,
    );
    if (process.env.DATABASE_URL) {
      const { readMusic } = await import("@/server/music/selections");
      try {
        const onRepeat = await readMusic();
        bootstrap.profiles = bootstrap.profiles.map((profile) =>
          profile.person.id === bootstrap.viewerId
            ? { ...profile, onRepeat }
            : profile,
        );
      } catch {
        /* A database outage must not take down the local shell. Saves fail closed. */
      }
    }
    content = (
      <PreviewProvider
        bootstrap={bootstrap}
        loadFriendProfileAction={loadDevelopmentFriendProfile}
      >
        {content}
      </PreviewProvider>
    );
  }
  return (
    <html lang="en" className={`${inter.variable} ${caudex.variable}`}>
      <body>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.CLERK_SECRET_KEY ? (
          <ClerkProvider
            dynamic
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            appearance={{
              variables: {
                fontFamily: "var(--font-body)",
                fontFamilyButtons: "var(--font-body)",
                fontSize: {
                  xs: "1rem",
                  sm: "1rem",
                  md: "1rem",
                  lg: "1.125rem",
                  xl: "1.25rem",
                },
                colorForeground: "#30383D",
                colorMutedForeground: "#53595C",
                colorInputForeground: "#30383D",
                colorInput: "#FCFBFA",
                colorBackground: "#FAF9F6",
              },
              elements: {
                formFieldInput: {
                  minHeight: "44px",
                  height: "auto",
                  lineHeight: "1.5",
                  "&::placeholder": { color: "#53595C", opacity: 1 },
                },
                formFieldLabel: { lineHeight: "1.5" },
              },
            }}
          >
            <AccountSession enabled>{content}</AccountSession>
          </ClerkProvider>
        ) : (
          <AccountSession enabled={false}>{content}</AccountSession>
        )}
      </body>
    </html>
  );
}
