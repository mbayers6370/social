import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MobileViewport } from "@/components/shared/mobile-viewport";
import "@/styles/globals.css";
import "@/styles/application.css";

const aside = localFont({
  src: [
    {
      path: "../../public/fonts/margin-aside/margin-aside-light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/margin-aside/margin-aside-medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/margin-aside/margin-aside-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-aside",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
const inter = localFont({
  src: "../../public/fonts/inter/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://margin.social"),
  referrer: "no-referrer",
  title: {
    default: "Margin · Interactive social concept",
    template: "%s · Margin",
  },
  description:
    "Explore Margin, an interactive portfolio demonstration of a thoughtful social interface. Fictional accounts, local interactions, no registration.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Margin",
    title: "Margin · Interactive social concept",
    description:
      "A feed that ends. An interactive portfolio demonstration with fictional accounts.",
    images: [
      {
        url: "/social-card.png",
        width: 1200,
        height: 630,
        alt: "Margin · A feed that ends. Imagine.",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${aside.variable}`}>
      <body>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-background px-4 py-3 focus:not-sr-only"
        >
          Skip to content
        </a>
        <MobileViewport />
        {children}
      </body>
    </html>
  );
}
