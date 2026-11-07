import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          hover: "hsl(var(--primary-hover) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        "button-border": "hsl(var(--button-border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        serif: ["var(--font-serif)"],
      },
      fontSize: {
        base: ["var(--text-body)", { lineHeight: "1.5" }],
        lg: ["var(--text-title)", { lineHeight: "1.5" }],
        xl: ["var(--text-subtitle)", { lineHeight: "1.4" }],
        "2xl": ["var(--text-heading-sm)", { lineHeight: "1.3" }],
        "3xl": [
          "calc(1.875rem + var(--reading-size-adjustment))",
          { lineHeight: "1.2" },
        ],
        "4xl": ["var(--text-display-sm)", { lineHeight: "1.15" }],
        sm: ["var(--text-control)", { lineHeight: "1.5" }],
        xs: ["var(--text-meta)", { lineHeight: "1.5" }],
        display: [
          "calc(clamp(2.5rem, 6vw, 4rem) + var(--reading-size-adjustment))",
          { lineHeight: "1.08", letterSpacing: "-0.045em", fontWeight: "600" },
        ],
      },
      maxWidth: { content: "68rem", reading: "42rem" },
    },
  },
  plugins: [],
} satisfies Config;
