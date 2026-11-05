import type { Appearance } from "@clerk/ui";

const focusRing = {
  outline: "2px solid hsl(var(--blackened-olive))",
  outlineOffset: "2px",
};

/** Margin's visual treatment for Clerk's account panel; Clerk owns its layout and flows. */
export const accountProfileAppearance = {
  variables: {
    fontSize: {
      xs: "var(--text-caption-sm)",
      sm: "var(--text-caption)",
      md: "var(--text-body)",
      lg: "var(--text-title)",
      xl: "var(--text-subtitle)",
    },
    colorNeutral: "hsl(var(--blackened-olive))",
    colorMuted: "hsl(var(--background))",
    colorBorder: "hsl(var(--profile-card-header))",
    colorRing: "hsl(var(--blackened-olive))",
    colorShadow: "hsl(var(--ink))",
    colorDanger: "hsl(var(--destructive))",
    colorModalBackdrop: "hsl(var(--ink) / 0.4)",
  },
  elements: {
    cardBox: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--profile-card-header))",
      borderRadius: "var(--radius-card)",
      boxShadow: "0 12px 40px hsl(var(--ink) / 0.12)",
    },
    navbar: {
      background: "hsl(var(--background))",
      backgroundImage: "none",
      "& h1": {
        fontFamily: "var(--font-serif)",
        fontSize: "var(--text-heading-md)",
        fontWeight: "500",
        lineHeight: "1.2",
        letterSpacing: "-0.025em",
        color: "hsl(var(--blackened-olive))",
      },
    },
    navbarButton: {
      minHeight: "44px",
      border: "1px solid transparent",
      borderRadius: "var(--radius-control)",
      color: "hsl(var(--ink))",
      fontSize: "var(--text-body)",
      boxShadow: "none",
      "&:hover": { background: "hsl(var(--profile-card-header) / 0.15)" },
      '&[data-active="true"]': {
        background: "hsl(var(--profile-card-header) / 0.3)",
        borderColor: "hsl(var(--profile-card-header))",
        color: "hsl(var(--blackened-olive))",
        fontWeight: "500",
      },
      "&:focus-visible": focusRing,
    },
    navbarButtonIcon: { color: "hsl(var(--blackened-olive))", opacity: "1" },
    navbarMobileMenuRow: { background: "hsl(var(--background))" },
    navbarMobileMenuButton: {
      minHeight: "44px",
      fontFamily: "var(--font-serif)",
      color: "hsl(var(--blackened-olive))",
    },
    scrollBox: {
      background: "hsl(var(--card))",
      borderColor: "hsl(var(--profile-card-header))",
      borderRadius: "var(--radius-card)",
      boxShadow: "none",
    },
    headerTitle: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-heading-sm)",
      fontWeight: "500",
      lineHeight: "1.25",
      letterSpacing: "-0.025em",
      color: "hsl(var(--blackened-olive))",
    },
    profileSection: { borderTopColor: "hsl(var(--profile-card-header) / 0.6)" },
    profileSectionTitleText: {
      fontSize: "var(--text-body)",
      fontWeight: "500",
      color: "hsl(var(--ink))",
    },
    profileSectionPrimaryButton: {
      minHeight: "44px",
      padding: "8px 12px",
      fontSize: "var(--text-body)",
      borderRadius: "var(--radius-control)",
      color: "hsl(var(--blackened-olive))",
      "&:hover": { background: "hsl(var(--profile-card-header) / 0.2)" },
      '&[data-color="danger"]': {
        color: "hsl(var(--destructive))",
        "&:hover": { background: "hsl(var(--destructive) / 0.08)" },
      },
      "&:focus-visible": focusRing,
    },
    formFieldInput: { background: "hsl(var(--card))" },
    formButtonReset: {
      minHeight: "44px",
      fontSize: "var(--text-body)",
      color: "hsl(var(--ink))",
    },
    badge: {
      background: "hsl(var(--muted))",
      color: "hsl(var(--blackened-olive))",
      border: "1px solid hsl(var(--profile-card-header) / 0.6)",
      fontSize: "var(--text-caption)",
      boxShadow: "none",
    },
    avatarBox: {
      border: "1px solid hsl(var(--profile-card-header))",
      borderRadius: "12px",
    },
    menuList: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--profile-card-header))",
      borderRadius: "var(--radius-menu)",
    },
    modalCloseButton: {
      minWidth: "44px",
      minHeight: "44px",
      color: "hsl(var(--blackened-olive))",
      borderRadius: "var(--radius-control)",
      "&:hover": { background: "hsl(var(--profile-card-header) / 0.2)" },
      "&:focus-visible": focusRing,
    },
  },
} satisfies NonNullable<Appearance["userProfile"]>;
