import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicDocument } from "@/features/public-site/public-document";
import { publicDocuments } from "@/features/public-site/documents";
import { PublicShell } from "@/features/public-site/public-shell";
import { PublicHome } from "@/features/public-site/public-home";
import { isPublicPage } from "@/lib/public-routes";
import {
  POSTING_RULE_SUMMARY,
  POSTING_EDIT_RULE,
  POSTING_EXCLUSIONS,
  MINIMUM_AGE,
} from "@/lib/platform-rules";
afterEach(() => vi.unstubAllEnvs());
it("keeps every policy visibly draft with the temporary contact and unconfirmed operator", () => {
  for (const document of Object.values(publicDocuments)) {
    const html = renderToStaticMarkup(<PublicDocument document={document} />);
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelectorAll("h1")).toHaveLength(1);
    if ("draft" in document && document.draft) {
      const note = page.querySelector("aside")!;
      expect(note.textContent).toContain("Draft · No effective date");
      expect(note.textContent).toContain("support@example.com");
      expect(note.textContent).toContain("not a monitored support inbox");
      expect(note.textContent).toContain(
        "legal operator has not been confirmed",
      );
    }
    for (const link of page.querySelectorAll<HTMLAnchorElement>("a[href^='#']"))
      expect(page.getElementById(link.hash.slice(1))).not.toBeNull();
  }
});
it("shares the exact posting copy between practical pages", () => {
  for (const document of [
    publicDocuments["how-it-works"],
    publicDocuments.help,
    publicDocuments.terms,
  ]) {
    const html = renderToStaticMarkup(<PublicDocument document={document} />);
    const text = new DOMParser().parseFromString(html, "text/html").body
      .textContent!;
    for (const rule of [
      POSTING_RULE_SUMMARY,
      POSTING_EDIT_RULE,
      POSTING_EXCLUSIONS,
    ])
      expect(text).toContain(rule);
    expect(text).toContain("America/Los_Angeles");
  }
  expect(JSON.stringify(publicDocuments["how-it-works"])).toContain("18");
});
it("renders the public home and footer as server markup with valid public destinations", () => {
  vi.stubEnv("NODE_ENV", "development");
  const html = renderToStaticMarkup(
    <PublicShell>
      <PublicHome />
    </PublicShell>,
  );
  const page = new DOMParser().parseFromString(html, "text/html");
  expect(page.querySelectorAll("main")).toHaveLength(1);
  expect(page.querySelectorAll("h1")).toHaveLength(1);
  expect(page.querySelector("footer")?.textContent).toContain(
    "A little less, a little closer.",
  );
  expect(
    [...page.querySelectorAll("footer h2")].map((node) => node.textContent),
  ).toEqual(["Explore", "Support", "Legal"]);
  for (const link of page.querySelectorAll<HTMLAnchorElement>("a"))
    expect(
      isPublicPage(
        new URL(link.getAttribute("href")!, "https://margin.invalid").pathname,
      ),
    ).toBe(true);
  expect(html).not.toContain("Ines");
  expect(page.querySelectorAll("form, iframe, video, audio")).toHaveLength(0);
  const hero = page.querySelector<HTMLElement>(".margin-public-hero")!;
  expect(hero.textContent).toContain("Registration isn’t open yet.");
  expect(hero.textContent).toContain(`For people ${MINIMUM_AGE} and over.`);
  expect(hero.querySelector(".margin-welcome-cta")?.getAttribute("href")).toBe(
    "/join",
  );
  const signup = hero.querySelector<HTMLAnchorElement>(".margin-welcome-cta")!;
  expect(signup.textContent).toBe("Coming soon");
  expect(
    page.getElementById(signup.getAttribute("aria-describedby")!)?.textContent,
  ).toContain("Registration isn’t open yet.");
  expect(
    page.querySelector('nav[aria-label="Public navigation"] a[href="/join"]')
      ?.textContent,
  ).toBe("Coming soon");
  expect(
    page.querySelector(".margin-welcome-principles")?.textContent,
  ).toContain("Share a few moments. Leave room for living them.");
  const preview = page.querySelector("figure")!;
  expect(preview.getAttribute("aria-label")).toBe(
    "Example post and conversation",
  );
  expect(preview.textContent).toContain("That’s everything for now.");
  // The public illustration must not expose private app controls or lazy-load its hero image.
  expect(preview.querySelectorAll("button, a, input, textarea")).toHaveLength(
    0,
  );
  const photo = preview.querySelector("img")!;
  expect(photo.getAttribute("loading")).toBe("eager");
  expect(photo.getAttribute("fetchPriority")?.toLowerCase()).toBe("high");
  expect(photo.getAttribute("alt")).toBeTruthy();
  expect(photo.getAttribute("src")).toContain("long-way-round");
  for (const link of page.querySelectorAll<HTMLAnchorElement>(
    'a[href^="/how-it-works#"]',
  )) {
    const destination = renderToStaticMarkup(
      <PublicDocument document={publicDocuments["how-it-works"]} />,
    );
    expect(
      new DOMParser()
        .parseFromString(destination, "text/html")
        .getElementById(link.hash.slice(1)),
    ).not.toBeNull();
  }
});
