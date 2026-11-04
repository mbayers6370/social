/** Presentation exploration stays available without burdening every merge. */
export const presentationFiles = [
  "custom-fonts.spec.ts",
  "icon-motion.spec.ts",
  "notebook-appearance.spec.ts",
  "quiet-empty.spec.ts",
];

/** Only these files exercise routes available in the production build. */
export const productionFiles = [
  "account-entry.spec.ts",
  "authentication.spec.ts",
  "foundation.spec.ts",
  "public-pages.spec.ts",
  "auth-layout.spec.ts",
  "favicon.spec.ts",
  "invitations.spec.ts",
];

export const mobileOnlyFiles = [
  "mobile-shell.spec.ts",
  "mobile-interactions.spec.ts",
];
