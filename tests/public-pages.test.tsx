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
    const ids = [...page.querySelectorAll("[id]")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const link of page.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/"]',
    )) {
      const url = new URL(link.getAttribute("href")!, "https://margin.invalid");
      expect(isPublicPage(url.pathname)).toBe(true);
      if (url.hash) {
        const destination =
          publicDocuments[
            url.pathname.slice(1) as keyof typeof publicDocuments
          ];
        expect(
          destination?.sections.some(
            (section) => section.id === url.hash.slice(1),
          ),
        ).toBe(true);
      }
    }
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
        new URL(link.getAttribute("href")!, "https://margin.invalid/welcome")
          .pathname,
      ),
    ).toBe(true);
  expect(html).not.toContain("Ines");
  expect(page.querySelectorAll("form, iframe, video, audio")).toHaveLength(0);
  const hero = page.querySelector<HTMLElement>(".margin-public-hero")!;
  expect(hero.textContent).toContain("An invitation code to begin.");
  const primary = hero.querySelector<HTMLAnchorElement>(".margin-welcome-cta")!;
  expect(primary.getAttribute("href")).toBe("/sign-up");
  expect(primary.textContent).toBe("Join Margin");
  expect(page.getElementById("welcome-preview")).not.toBeNull();
  expect(page.querySelector(".margin-welcome-joining")?.textContent).toContain(
    "Start with your invitation.",
  );
  expect(
    page.querySelector('nav[aria-label="Public navigation"] a[href="/sign-up"]')
      ?.textContent,
  ).toBe("Join Margin");
  expect(hero.querySelectorAll("figure")).toHaveLength(1);
  const preview = page.querySelector("figure")!;
  expect(preview.getAttribute("aria-label")).toBe("Feed and conversation");
  expect(preview.textContent).toContain("That’s everything for now.");
  // The bounded public control opens only fictional discussion, never private app data.
  expect(preview.querySelectorAll("button")).toHaveLength(2);
  expect(preview.querySelector("button")?.getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(preview.querySelectorAll("a, input, textarea")).toHaveLength(0);
  const photo = preview.querySelector("img")!;
  expect(photo.getAttribute("loading")).toBe("eager");
  expect(photo.getAttribute("fetchPriority")?.toLowerCase()).toBe("high");
  expect(photo.getAttribute("alt")).toBeTruthy();
  expect(photo.getAttribute("src")).toContain("coffee-shop");
  const messages = page.querySelector(
    'figure[aria-label="Messages between friends"]',
  )!;
  expect(messages.textContent).toContain("Coffee there this weekend?");
  expect(messages.querySelectorAll("button, a, input, textarea")).toHaveLength(
    0,
  );
  expect(messages.textContent).not.toMatch(
    /encrypted|end.to.end|delivered|online/i,
  );
  expect(hero.contains(messages)).toBe(false);
  for (const id of [
    "welcome-pace-title",
    "welcome-connection-title",
    "welcome-gallery-title",
  ])
    expect(page.getElementById(id)?.tagName).toBe("H2");
  const gallery = page.querySelector(".margin-welcome-gallery")!;
  expect(gallery.querySelectorAll("img")).toHaveLength(3);
  expect(gallery.querySelectorAll("button, a")).toHaveLength(0);
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
