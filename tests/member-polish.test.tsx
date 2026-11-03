import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberSearch } from "@/features/social/member-search";
import { MemberNotifications } from "@/features/social/member-notifications";
import { MemberProvider } from "@/features/social/member-provider";
import { sampleIdentity } from "@/features/social/member-preview";
import { PhotoViewerFigure } from "@/components/shared/photo-viewer-figure";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PostCard } from "@/features/feed/post-card";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ activity: [], nextCursor: null })),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("identifies profile lookup as a search rather than a credential field", async () => {
  const user = userEvent.setup();
  render(<MemberSearch />);
  await user.click(screen.getByRole("button", { name: "Search profiles" }));
  const search = screen.getByRole("search", { name: "Find a member" });
  const input = within(search).getByRole("searchbox", {
    name: "Search members",
  });
  expect(search).toHaveAttribute("autocomplete", "off");
  expect(input).toHaveAttribute("name", "member-search-query");
  expect(input).toHaveAttribute("autocomplete", "off");
  expect(input).toHaveAttribute("data-1p-ignore");
  expect(search.querySelector('input[type="password"]')).toBeNull();
});
it("gives empty notifications a distinct heading and explanation without a disabled bulk action", async () => {
  const user = userEvent.setup();
  render(
    <MemberProvider initial={sampleIdentity}>
      <MemberNotifications />
    </MemberProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  const heading = await screen.findByRole("heading", {
    name: "You’re all caught up",
    level: 3,
  });
  expect(heading.parentElement).toHaveClass("margin-notifications-empty");
  expect(
    within(heading.parentElement!).getByText("New activity will appear here."),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Mark all as read" }),
  ).not.toBeInTheDocument();
});
it.each(["", "An intentional caption"])(
  "keeps alt text accessible and on hover without turning it into a visible caption (%s)",
  (caption) => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Photograph</DialogTitle>
          <PhotoViewerFigure
            photo={{
              description: "Image description",
              caption,
              aspect: "landscape",
              image: {
                src: "/_next/static/media/sample.jpg",
                width: 600,
                height: 400,
              },
            }}
            sizes="600px"
          />
        </DialogContent>
      </Dialog>,
    );
    const image = screen.getByRole("img", { name: "Image description" });
    expect(image).toHaveAttribute("title", "Image description");
    const figure = image.closest("figure")!;
    const description = figure.querySelector("figcaption")!;
    if (caption) {
      expect(description).toHaveClass("margin-photo-caption");
      expect(description).toHaveTextContent(caption);
    } else {
      expect(description).toHaveClass("sr-only");
      expect(figure.querySelector(".margin-photo-caption")).toBeNull();
    }
    expect(container).not.toBeNull();
  },
);
it("marks profile posts explicitly so their flat surface does not depend on a particular parent wrapper", () => {
  render(
    <PostCard
      profileDate
      reportAction={null}
      post={{
        id: "post",
        author: sampleIdentity.person,
        createdAt: "2026-11-02T12:00:00Z",
        expiresAt: "2026-12-02T12:00:00Z",
        paragraphs: ["A thought"],
        likes: 0,
        comments: [],
      }}
    />,
  );
  expect(screen.getByRole("article")).toHaveAttribute(
    "data-profile-post",
    "true",
  );
});
