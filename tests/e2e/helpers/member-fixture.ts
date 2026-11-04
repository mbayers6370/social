import type { Page } from "../fixtures";
import { readFileSync } from "node:fs";
export const identity = {
  person: {
    id: "fictional-member",
    name: "Sample Member",
    initials: "SM",
    tone: "paper",
  },
  username: "sample_member",
  bio: "Small moments, kept close.",
  portraitPhotoId: null,
  usernameChangedAt: null,
  galleryVersion: 0,
  preferences: {
    readingSize: "standard",
    motion: "system",
    notifyComments: true,
    notifyLikes: false,
    notifyFriends: true,
    notifyMessages: true,
    messagingEnabled: true,
  },
};
export const friend = {
  id: "fictional-friend",
  name: "Alex Example",
  initials: "AE",
  tone: "paper",
};
export const conversation = {
  thread: {
    id: friend.id,
    contact: friend,
    notebook: false,
    canSend: true,
    unread: false,
    preview: "See you on Saturday.",
    updatedAt: "2026-11-02T19:00:00Z",
  },
  messages: [
    {
      id: "fictional-message",
      body: "See you on Saturday.",
      direction: "incoming",
      createdAt: "2026-11-02T19:00:00Z",
    },
  ],
  nextCursor: null,
};
export async function memberFixture(page: Page) {
  let currentIdentity = structuredClone(identity);
  await page.route("**/__member_fixture/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/__member_fixture", "");
    if (path.startsWith("/api/photos/"))
      return route.fulfill({
        contentType: "image/jpeg",
        body: readFileSync("src/assets/fixtures/tea.jpg"),
      });
    if (path === "/api/member/context")
      return route.fulfill({ json: currentIdentity });
    if (path === "/api/posts/allowance")
      return route.fulfill({
        json: { regularRemaining: 3, linkAllowed: true },
      });
    if (path === "/api/notifications")
      return route.fulfill({ json: { activity: [], nextCursor: null } });
    if (path === "/api/gallery/photos")
      return route.fulfill({ json: { photos: [], nextCursor: null } });
    if (path === "/api/messages")
      return route.fulfill({
        json: {
          threads: [
            {
              ...conversation.thread,
              id: identity.person.id,
              contact: identity.person,
              notebook: true,
              preview: "A note for later.",
            },
            conversation.thread,
          ],
          nextCursor: null,
        },
      });
    if (
      path === `/api/messages/${identity.person.id}` &&
      route.request().method() === "GET"
    )
      return route.fulfill({
        json: {
          thread: {
            ...conversation.thread,
            id: identity.person.id,
            contact: identity.person,
            notebook: true,
          },
          messages: [],
          nextCursor: null,
        },
      });
    if (path === "/api/member/preferences") {
      currentIdentity = {
        ...currentIdentity,
        preferences: {
          ...currentIdentity.preferences,
          ...route.request().postDataJSON(),
        },
      };
      return route.fulfill({ json: currentIdentity });
    }
    if (
      path === "/api/messages/fictional-friend" &&
      route.request().method() === "GET"
    )
      return route.fulfill({ json: conversation });
    if (path === "/api/friends")
      return route.fulfill({
        json: {
          contacts: [
            {
              person: friend,
              username: "alex_example",
              relationship: "friends",
              friendsSince: "2026-03-12T12:00:00Z",
            },
          ],
          nextCursor: null,
        },
      });
    return route.fulfill({
      status: 503,
      json: { error: "This fixture action needs an explicit test response." },
    });
  });
  // A rendering fixture must never send mutations to actual member endpoints.
  await page.route("**/api/**", (route) => {
    if (
      new URL(route.request().url()).pathname.startsWith("/__member_fixture/")
    )
      return route.fallback();
    return route.fulfill({
      status: 503,
      json: {
        error: "Real account requests are disabled in this rendering test.",
      },
    });
  });
}
