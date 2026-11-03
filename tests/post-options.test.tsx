import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostCard } from "@/features/feed/post-card";
import { PreviewProvider } from "@/features/local-preview/provider";
import {
  SpacesPreviewProvider,
  useSpacesPreview,
} from "@/features/spaces/preview-provider";
import { SpaceClientProvider } from "@/features/spaces/client";
import { SpacePostCard } from "@/features/spaces/space-post-card";
import { SafetySettings } from "@/features/safety/safety-settings";
import { previewBootstrap } from "./helpers/local-preview-fixture";
import { spacesFixture } from "./helpers/spaces-fixture";
import { createSpacePreviewReport } from "@/features/spaces/preview-report";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.spyOn(window, "scrollTo").mockImplementation(() => {}));

it("keeps conversation in the footer and supports menu keys, reporting, and focus restoration", async () => {
  const user = userEvent.setup();
  const data = previewBootstrap();
  const post = {
    id: "post-menu",
    author: data.profiles[1].person,
    createdAt: data.now,
    expiresAt: "2026-11-26T20:00:00Z",
    paragraphs: ["A thought"],
    likes: 0,
    comments: [],
    audience: "friends" as const,
  };
  data.posts = [post];
  render(
    <PreviewProvider bootstrap={data}>
      <PostCard post={post} onOpenConversation={vi.fn()} />
    </PreviewProvider>,
  );
  const card = screen.getByRole("article");
  const trigger = screen.getByRole("button", {
    name: `Post options for ${post.author.name}`,
  });
  expect(card.querySelector(".margin-post-author")).toContainElement(trigger);
  expect(card.querySelector(".margin-post-footer")).toContainElement(
    screen.getByRole("button", { name: /Conversation on/ }),
  );
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
  await user.keyboard("{End}");
  const report = screen.getByRole("menuitem", { name: "Report post" });
  expect(report).toHaveFocus();
  expect(report).toHaveTextContent("Report post");
  await user.keyboard("{Enter}");
  const dialog = screen.getByRole("dialog", { name: "Report post" });
  await user.selectOptions(within(dialog).getByLabelText("Reason"), "spam");
  await user.tab();
  expect(within(dialog).getByLabelText("Details (optional)")).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: "Save report" }));
  await screen.findByRole("dialog", { name: "Report saved" });
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

function SpaceCards() {
  const spaces = useSpacesPreview();
  return (
    <SpaceClientProvider client={spaces.client}>
      {spaces.detailsFor("sample-room") && <span>Still a member</span>}
      {spaces.feedPosts.map((post) => (
        <SpacePostCard
          key={post.id}
          post={post}
          viewerId={spaces.data.viewer.id}
          inFeed
        />
      ))}
    </SpaceClientProvider>
  );
}
it("reports a canonical Space post into local safety records and removes only its feed inclusion", async () => {
  const user = userEvent.setup();
  const data = spacesFixture();
  data.spaces[0].includeInFeed = true;
  render(
    <PreviewProvider bootstrap={previewBootstrap()}>
      <SpacesPreviewProvider bootstrap={data}>
        <SpaceCards />
        <SafetySettings />
      </SpacesPreviewProvider>
    </PreviewProvider>,
  );
  const trigger = screen.getByRole("button", { name: /Post options for/ });
  await user.click(trigger);
  await user.click(screen.getByRole("menuitem", { name: "Report post" }));
  await user.selectOptions(screen.getByLabelText("Reason"), "privacy");
  await user.click(screen.getByRole("button", { name: "Save report" }));
  await screen.findByRole("dialog", { name: "Report saved" });
  await user.click(screen.getByRole("button", { name: "Done" }));
  await user.click(screen.getByText("Your reports"));
  expect(
    screen.getByText("Post by Theo Marchetti in Japan 2027"),
  ).toBeVisible();
  await user.click(trigger);
  expect(screen.getByRole("menuitem", { name: "Open Space" })).toHaveAttribute(
    "href",
    "/preview/spaces?space=sample-room",
  );
  await user.click(
    screen.getByRole("menuitem", { name: "Remove Space from my Feed" }),
  );
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByText("Still a member")).toBeVisible();
});

it("denies local reports for owned, expired, blocked, or inaccessible Space posts", () => {
  const data = spacesFixture();
  const target = {
    kind: "post" as const,
    id: data.posts[0].id,
    personId: data.posts[0].author.id,
    label: "Shared suggestion",
  };
  const report = { target, reason: "spam" as const, details: "" };
  expect(createSpacePreviewReport(data, [], data.now, report)).toMatchObject({
    status: "saved-locally",
  });
  expect(() =>
    createSpacePreviewReport(
      data,
      [],
      Date.parse(data.posts[0].expiresAt),
      report,
    ),
  ).toThrow();
  expect(() =>
    createSpacePreviewReport(
      data,
      [
        {
          people: [data.viewer.id, target.personId],
          status: "blocked",
          blockedBy: data.viewer.id,
        },
      ],
      data.now,
      report,
    ),
  ).toThrow();
  const own = structuredClone(data);
  own.posts[0].author = own.viewer;
  expect(() =>
    createSpacePreviewReport(own, [], own.now, {
      ...report,
      target: { ...target, personId: own.viewer.id },
    }),
  ).toThrow();
  data.spaces[0].members = [];
  expect(() => createSpacePreviewReport(data, [], data.now, report)).toThrow();
});

it("keeps authenticated photo bytes out of the image optimizer in both thumbnail and full viewer", async () => {
  const user = userEvent.setup();
  const post = spacesFixture().posts[0];
  render(
    <SpacePostCard
      post={{
        ...post,
        photos: [
          {
            id: "protected",
            width: 400,
            height: 300,
            description: "Protected scene",
          },
        ],
      }}
      viewerId="ines"
    />,
  );
  expect(screen.getByRole("img", { name: "Protected scene" })).toHaveAttribute(
    "src",
    "/api/photos/protected",
  );
  await user.click(screen.getByRole("button", { name: /View photograph/ }));
  expect(
    within(await screen.findByRole("dialog")).getByRole("img", {
      name: "Protected scene",
    }),
  ).toHaveAttribute("src", "/api/photos/protected");
});

it("uses the authenticated report endpoint for live cards and preserves a rejected report for retry", async () => {
  const user = userEvent.setup();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Report unavailable" }), {
        status: 403,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "saved-report" }), { status: 201 }),
    );
  vi.stubGlobal("fetch", fetcher);
  const post = spacesFixture().posts[0];
  render(<SpacePostCard post={post} viewerId="ines" />);
  const trigger = screen.getByRole("button", { name: /Post options for/ });
  await user.click(trigger);
  await user.click(screen.getByRole("menuitem", { name: "Report post" }));
  await user.selectOptions(screen.getByLabelText("Reason"), "privacy");
  await user.type(
    screen.getByLabelText("Details (optional)"),
    "Please check this photograph.",
  );
  await user.click(screen.getByRole("button", { name: "Submit report" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Report unavailable",
  );
  expect(screen.getByLabelText("Reason")).toHaveValue("privacy");
  expect(screen.getByLabelText("Details (optional)")).toHaveValue(
    "Please check this photograph.",
  );
  expect(fetcher).toHaveBeenCalledWith(
    "/api/reports",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        target: {
          kind: "post",
          id: post.id,
          personId: post.author.id,
          label: `Post by ${post.author.name} in ${post.space!.name}`,
        },
        reason: "privacy",
        details: "Please check this photograph.",
      }),
    }),
  );
  await user.click(screen.getByRole("button", { name: "Submit report" }));
  await screen.findByRole("dialog", { name: "Report submitted" });
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(trigger).toHaveFocus();
});
