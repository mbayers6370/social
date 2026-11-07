import type { Appearance } from "@clerk/ui";
import { accountProfileAppearance } from "./account-profile-appearance";

/** Shared Margin form tokens, including Clerk's explicit interactive variants. */
export const clerkAppearance = {
  userProfile: accountProfileAppearance,
  variables: {
    fontFamily: "var(--font-body)",
    fontFamilyButtons: "var(--font-body)",
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    colorForeground: "hsl(var(--ink))",
    colorMutedForeground: "hsl(var(--muted-foreground))",
    colorInputForeground: "hsl(var(--ink))",
    colorInput: "hsl(var(--background))",
    colorBackground: "hsl(var(--card))",
    // Text links use dark ink; primary actions share the application button pair.
    colorPrimary: "hsl(var(--ink))",
    colorPrimaryForeground: "hsl(var(--parchment))",
    borderRadius: "var(--radius-control)",
  },
  elements: {
    formFieldInput: {
      minHeight: "44px",
      height: "auto",
      padding: "8px 12px",
      fontSize: "var(--text-body)",
      lineHeight: "1.5",
      border: "1px solid hsl(var(--input))",
      borderRadius: "var(--radius-control)",
      boxShadow: "none",
      background: "hsl(var(--background))",
      '&[data-variant="default"]': {
        borderWidth: "1px",
        boxShadow: "none",
        "&:focus": {
          borderColor: "hsl(var(--ring))",
          boxShadow: "0 0 0 2px hsl(var(--ring))",
        },
      },
      "&::placeholder": { color: "hsl(var(--muted-foreground))", opacity: 1 },
    },
    formFieldLabel: {
      fontSize: "var(--text-body)",
      fontWeight: "500",
      lineHeight: "1.5",
    },
    formFieldLabelRow: { marginBottom: "8px" },
    formFieldAction: {
      color: "hsl(var(--foreground))",
      textUnderlineOffset: "4px",
    },
    formButtonPrimary: {
      minHeight: "44px",
      padding: "8px 16px",
      fontSize: "0.875rem",
      fontWeight: "500",
      background: "hsl(var(--primary))",
      backgroundImage: "none",
      color: "hsl(var(--primary-foreground))",
      border: "1px solid hsl(var(--button-border))",
      borderRadius: "var(--radius-control)",
      boxShadow: "none",
      '&[data-variant="solid"]': {
        borderWidth: "1px",
        boxShadow: "none",
        "&::after": { background: "none" },
        "&:focus-visible": {
          outline: "2px solid hsl(var(--ring))",
          outlineOffset: "2px",
        },
      },
      '&[data-variant="solid"]:not(:disabled)': {
        boxShadow: "none",
        "&:hover, &:active": {
          background: "hsl(var(--primary-hover))",
          boxShadow: "none",
        },
      },
    },
  },
} satisfies Appearance;

/** Page-mounted account forms share Margin's frame; Clerk owns every auth step. */
export const authAppearance = {
  options: {
    elevation: "flush",
    // Preview the finished interface locally; credentials remain Development keys.
    unsafe_disableDevelopmentModeWarnings: true,
  },
  elements: {
    rootBox: { width: "100%", maxWidth: "100%" },
    cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none" },
    card: {
      padding: "0",
      gap: "24px",
      boxShadow: "none",
      background: "transparent",
    },
    header: { textAlign: "left", margin: "0" },
    headerTitle: {
      fontFamily: "var(--font-serif)",
      fontSize: "2rem",
      fontWeight: "400",
      lineHeight: "1.2",
      letterSpacing: "-0.025em",
    },
    headerSubtitle: {
      marginTop: "12px",
      fontSize: "var(--text-body)",
      lineHeight: "1.6",
      color: "hsl(var(--muted-foreground))",
    },
    main: { gap: "24px" },
    form: { gap: "16px" },
    formFieldRow: { gap: "16px" },
    dividerRow: { margin: "0" },
    dividerText: {
      fontSize: "0.875rem",
      color: "hsl(var(--muted-foreground))",
    },
    socialButtonsBlockButton: {
      minHeight: "44px",
      padding: "8px 16px",
      fontSize: "0.875rem",
      fontWeight: "500",
      color: "hsl(var(--foreground))",
      border: "1px solid hsl(var(--button-border))",
      borderRadius: "var(--radius-control)",
      boxShadow: "none",
      background: "hsl(var(--background))",
      '&[data-variant="outline"]': { borderWidth: "1px", boxShadow: "none" },
      "&:hover": { background: "hsl(var(--accent))" },
      "&:focus-visible": {
        outline: "2px solid hsl(var(--ring))",
        outlineOffset: "2px",
      },
    },
    // This decorative floating badge competes with the provider label.
    lastAuthenticationStrategyBadge: { display: "none" },
    alternativeMethodsBlockButton: { minHeight: "44px", fontSize: "0.875rem" },
    formButtonReset: {
      minHeight: "44px",
      color: "hsl(var(--foreground))",
      fontSize: "0.875rem",
    },
    footer: { padding: "16px 0 0", background: "transparent" },
  },
} satisfies Appearance;

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Welcome back.",
      subtitle: "Sign in to pick up where you left off.",
    },
  },
  signUp: {
    start: {
      title: "A place for your people.",
      subtitle: "Join with an invitation.",
    },
  },
};
