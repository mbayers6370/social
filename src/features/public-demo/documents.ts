import { publicDocuments } from "@/features/public-site/documents";
import type { PublicDocumentData } from "@/features/public-site/public-document";
import { demoDocumentKeys } from "./routes";

const demonstration = {
  id: "portfolio-demo",
  title: "About this demonstration",
  paragraphs: [
    "Margin is an interactive portfolio concept using fictional accounts. Explore without registering. Changes stay in this browser tab and reset when you exit the demo or refresh.",
    "Authentication, invitations, hosted storage and external integrations are not connected to the public demonstration.",
  ],
  links: [{ label: "Explore Demo", href: "/demo/" }],
};
const retainedLink = (link: { href: string }) =>
  demoDocumentKeys.some(
    (key) => new URL(link.href, "https://demo.invalid").pathname === `/${key}`,
  );
export const portfolioDocuments: Record<string, PublicDocumentData> =
  Object.fromEntries(
    (["why-margin", "how-it-works"] as const).map((key) => {
      const document = publicDocuments[key];
      return [
        key,
        {
          ...document,
          draft: false,
          intro: `${document.intro} A design reference for the Margin portfolio concept.`,
          summary: [
            "Interactive portfolio · Fictional data · No registration",
            ...document.summary,
          ],
          related: document.related?.filter(retainedLink),
          sections: [
            demonstration,
            ...document.sections.map((section) => ({
              ...section,
              links: section.links?.filter(retainedLink),
            })),
          ],
        },
      ];
    }),
  );
portfolioDocuments["your-data"] = {
  category: "Explore",
  title: "Your demo data",
  intro: "An interactive demonstration with fictional people and local state.",
  summary: [
    "No registration or email collection",
    "No uploads, real messaging or analytics integrations",
    "Exit demo or refresh clears your changes",
  ],
  sections: [
    demonstration,
    {
      id: "audience",
      title: "What stays in your tab",
      paragraphs: [
        "Posts, comments, reactions, messages, Notebook entries, profile edits and preferences are simulated in memory. The demo does not save them to a server or browser storage. Avoid entering sensitive information in a portfolio demonstration.",
        "Sample photographs and record artwork are bundled with the site. Device uploads and live invitations are disabled. Optional exports download only fictional content and edits from your tab.",
      ],
    },
    {
      id: "photographs",
      title: "Sample photographs",
      paragraphs: [
        "Photographs are bundled fictional demonstration assets. Choosing a saved photograph changes only your tab; device uploads and private photo delivery are unavailable in the public demo.",
      ],
    },
    {
      id: "hosting",
      title: "Hosting and external links",
      paragraphs: [
        "The static host receives ordinary requests for pages and assets and may maintain operational logs under its own policies. Margin does not load Clerk, Sentry, music catalogues, event services or advertising scripts in this demonstration.",
        "Music links open ordinary external websites only when you choose them. Those services have their own policies.",
      ],
    },
    {
      id: "demo-assets",
      title: "Demo assets and acknowledgements",
      paragraphs: [
        "Song and artist names identify the recordings linked by On Repeat. “Je veux” by Greg Gontier uses the Grégoire cover supplied for this demo; that artwork remains its owner’s property. The other bundled covers are original sample illustrations. No iTunes artwork service, audio, previews or catalogue metadata service is used.",
        "Inter by Rasmus Andersson and Noto Sans are distributed under the SIL Open Font License. Their licenses are included with the static assets. Existing Margin artwork and photograph credits remain with the original project. Spotify and Apple Music marks identify the destinations of ordinary external links and remain their owners’ trademarks.",
      ],
    },
  ],
};

portfolioDocuments.retention = {
  category: "Explore",
  title: "Demo retention",
  intro:
    "Your demo session is temporary. Nothing you write is saved as account data.",
  summary: [
    "State stays in this tab",
    "Exit demo or refresh resets the session",
    "No server-side message delivery or storage",
  ],
  sections: [
    demonstration,
    {
      id: "session",
      title: "When the session ends",
      paragraphs: [
        "Exit demo clears the interactive session before returning to the welcome page. Refreshing starts again with the fictional sample accounts. Browser history restoration starts a fresh demo rather than restoring your old changes.",
        "Posts, comments, reactions, messages, Notebook notes, profile edits, Space changes and preferences remain in memory during the session. They are not written to a database, localStorage, sessionStorage or cookies.",
      ],
    },
    {
      id: "sample-clock",
      title: "The fictional sample day",
      paragraphs: [
        "The demo uses a fixed sample date so its posts and conversations remain available. Displayed expiry labels illustrate the preserved application's design; no live retention worker runs for the demo.",
      ],
    },
    {
      id: "downloads",
      title: "Optional downloads",
      paragraphs: [
        "If you download your demo data, that file stays on your device until you delete it. Exiting the demo cannot remove files you have chosen to download.",
      ],
      links: [{ label: "Your demo data", href: "/your-data/" }],
    },
  ],
};
