import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberGallery } from "@/features/social/member-gallery";
import { PrivateProfile } from "@/features/social/private-profile";
import type { PrivateProfileData } from "@/features/social/contracts";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const request = vi.fn();
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    url === "/api/posts/allowance"
      ? Promise.resolve(
          Response.json({ regularRemaining: 3, linkAllowed: true }),
        )
      : request(url, init),
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
function profile(): PrivateProfileData {
  return {
    viewerId: "owner",
    profile: {
      id: "owner",
      name: "Alice",
      messagingEnabled: true,
      relationship: "self",
    },
    posts: [],
    gallery: [],
    requests: [],
    nextCursor: null,
  };
}
it("submits without a client identity and displays new content only after a server refresh", async () => {
  const user = userEvent.setup();
  request.mockResolvedValue(new Response("{}", { status: 201 }));
  const data = profile();
  const view = render(<PrivateProfile data={data} />);
  await user.click(screen.getByRole("button", { name: "New Post" }));
  await user.type(screen.getByLabelText("Your post"), "Durable thought");
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(request).toHaveBeenCalledWith(
    "/api/posts/publish",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ body: "Durable thought", photoIds: [] }),
    }),
  );
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  view.rerender(
    <PrivateProfile
      data={{
        ...data,
        posts: [
          {
            id: "saved",
            body: "Durable thought",
            createdAt: "2026-11-01T12:00:00Z",
            expiresAt: "2026-12-01T12:00:00Z",
            photos: [],
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("article")).toHaveTextContent("Durable thought");
});
it("preserves drafts after a rejection and stops resubmission when a create result is uncertain", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "Daily post allowance reached" }), {
      status: 409,
    }),
  );
  render(<PrivateProfile data={profile()} />);
  await user.click(screen.getByRole("button", { name: "New Post" }));
  const input = screen.getByLabelText("Your post");
  await user.type(input, "Keep this draft");
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Daily post allowance reached",
  );
  expect(input).toHaveValue("Keep this draft");
  request.mockRejectedValueOnce(new Error("Disconnected"));
  await user.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled(),
  );
  expect(input).toHaveValue("Keep this draft");
  expect(
    screen.getByRole("button", { name: "Check saved posts" }),
  ).toBeVisible();
  expect(request).toHaveBeenCalledTimes(2);
});
it("stages an owned saved photograph and sends only its ID when publishing", async () => {
  const user = userEvent.setup();
  request.mockImplementation(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url === "/api/gallery/photos"
            ? {
                photos: [
                  {
                    id: "private-photo",
                    description: "River bank",
                    width: 400,
                    height: 300,
                  },
                ],
                nextCursor: null,
              }
            : { id: "saved" },
        ),
        { status: 200 },
      ),
  );
  render(<PrivateProfile data={profile()} />);
  await user.click(screen.getByRole("button", { name: "New Post" }));
  await user.click(screen.getByRole("button", { name: "Add photographs" }));
  await user.click(
    await screen.findByRole("button", { name: "Select River bank" }),
  );
  await user.click(screen.getByRole("button", { name: "Use photograph" }));
  expect(
    request.mock.calls.filter(([url]) => url === "/api/posts/publish"),
  ).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(request).toHaveBeenCalledWith(
    "/api/posts/publish",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ body: "", photoIds: ["private-photo"] }),
    }),
  );
});
it("uploads a gallery photograph without an image-description field or header", async () => {
  const user = userEvent.setup();
  request.mockResolvedValue(
    Response.json({
      id: "uploaded",
      description: "Photograph",
      width: 400,
      height: 300,
    }),
  );
  render(<MemberGallery data={profile()} />);
  await user.click(screen.getByRole("button", { name: "Add photo" }));
  const picker = screen.getByRole("dialog", { name: "Add Photograph" });
  expect(within(picker).queryByRole("textbox")).not.toBeInTheDocument();
  await user.upload(
    within(picker).getByLabelText("Photograph"),
    new File(["image"], "photo.jpg", { type: "image/jpeg" }),
  );
  await user.click(
    within(picker).getByRole("button", { name: "Upload photograph" }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/api/gallery/photo",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
      }),
    ),
  );
});

it("deletes an owned photograph directly from Gallery after confirmation", async () => {
  const user = userEvent.setup();
  request.mockResolvedValue(Response.json({ saved: true }));
  const data = profile();
  data.gallery = [
    { id: "private-photo", description: "River bank", width: 400, height: 300 },
  ];
  render(<MemberGallery data={data} />);
  await user.click(screen.getByRole("button", { name: "Delete photograph 1" }));
  const confirmation = screen.getByRole("dialog", {
    name: "Delete this photograph?",
  });
  expect(request).not.toHaveBeenCalled();
  expect(confirmation).toHaveTextContent(
    "still counts toward today’s upload allowance",
  );
  await user.click(
    within(confirmation).getByRole("button", { name: "Delete photograph" }),
  );
  await waitFor(() =>
    expect(screen.queryByAltText("River bank")).not.toBeInTheDocument(),
  );
  expect(request).toHaveBeenCalledWith(
    "/api/photos/private-photo",
    expect.objectContaining({ method: "DELETE" }),
  );
});

it("uses protected URLs and stages confirmed gallery deletions until Done", async () => {
  const user = userEvent.setup();
  request.mockResolvedValue(
    new Response(JSON.stringify({ saved: true }), { status: 200 }),
  );
  const data = profile();
  data.gallery = [
    { id: "private-photo", description: "River bank", width: 400, height: 300 },
  ];
  data.profile.galleryVersion = 7;
  render(<MemberGallery data={data} />);
  expect(screen.getByAltText("River bank")).toHaveAttribute(
    "src",
    "/api/photos/private-photo",
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(screen.getByRole("button", { name: /Select River bank/ }));
  await user.click(screen.getByRole("button", { name: "Delete photograph" }));
  const confirmation = screen.getByRole("alertdialog", {
    name: "Delete Photograph?",
  });
  expect(request).not.toHaveBeenCalled();
  await user.click(
    within(confirmation).getByRole("button", { name: "Delete photograph" }),
  );
  expect(request).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(request).toHaveBeenCalledWith(
    "/api/gallery",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        version: 7,
        entries: [],
        deletedPhotoIds: ["private-photo"],
      }),
    }),
  );
});
it("saves name and bio through the authenticated profile boundary and preserves a rejected edit", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "Please try again" }), {
      status: 503,
    }),
  );
  render(<PrivateProfile data={profile()} />);
  await user.click(screen.getByRole("button", { name: "Edit profile" }));
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "Alice Saved");
  await user.type(screen.getByLabelText("Bio"), "A private introduction");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again",
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Alice Saved");
  request.mockResolvedValueOnce(
    new Response(JSON.stringify({ saved: true }), { status: 200 }),
  );
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("form", { name: "Edit profile" }),
    ).not.toBeInTheDocument(),
  );
  expect(request).toHaveBeenLastCalledWith(
    "/api/profiles/me",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        name: "Alice Saved",
        bio: "A private introduction",
      }),
    }),
  );
});
it("keeps content and publishing controls out of the pending-friend view", () => {
  const data = profile();
  data.profile.relationship = "outgoing";
  render(<PrivateProfile data={data} />);
  expect(screen.getByText("Request sent")).toBeVisible();
  expect(screen.getByText("Posts are shared with friends.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Publish" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Invite someone" }),
  ).not.toBeInTheDocument();
});

it("keeps the profile entry in New Post and returns focus there after cancellation", async () => {
  const user = userEvent.setup();
  render(<PrivateProfile data={profile()} />);
  expect(
    screen.queryByRole("button", { name: "Share a thought…" }),
  ).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "New Post" });
  await user.click(trigger);
  await user.type(screen.getByLabelText("Your post"), "Keep my draft");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(trigger);
  expect(screen.getByLabelText("Your post")).toHaveValue("Keep my draft");
});

it("offers deletion inside the profile post editor and preserves the draft when confirmation is cancelled", async () => {
  const user = userEvent.setup();
  const data = profile();
  data.posts = [
    {
      id: "owned-post",
      body: "Original thought",
      createdAt: "2026-11-01T12:00:00Z",
      expiresAt: "2026-12-01T12:00:00Z",
      photos: [],
    },
  ];
  request.mockResolvedValue(Response.json({ saved: true }));
  render(<PrivateProfile data={data} />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.clear(screen.getByLabelText("Your post"));
  await user.type(screen.getByLabelText("Your post"), "An unsaved revision");
  await user.click(screen.getByRole("button", { name: "Delete post" }));
  const confirmation = screen.getByRole("alertdialog", {
    name: "Delete this post?",
  });
  expect(
    within(confirmation).getByRole("button", { name: "Keep post" }),
  ).toHaveFocus();
  expect(request).not.toHaveBeenCalled();
  await user.click(
    within(confirmation).getByRole("button", { name: "Keep post" }),
  );
  expect(screen.getByLabelText("Your post")).toHaveValue("An unsaved revision");
  expect(screen.getByRole("button", { name: "Delete post" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Delete post" }));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "Edit post" })).toBeVisible();
  expect(screen.getByLabelText("Your post")).toHaveValue("An unsaved revision");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(request).toHaveBeenCalledWith(
    "/api/posts/owned-post",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ body: "An unsaved revision" }),
    }),
  );
});

it("keeps a rejected deletion recoverable and refreshes the profile after confirmed deletion", async () => {
  const user = userEvent.setup();
  const data = profile();
  data.posts = [
    {
      id: "owned-post",
      body: "Original thought",
      createdAt: "2026-11-01T12:00:00Z",
      expiresAt: "2026-12-01T12:00:00Z",
      photos: [],
    },
  ];
  request
    .mockResolvedValueOnce(
      Response.json(
        { error: "Couldn’t delete your post. Try again." },
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ deleted: true }));
  const changed = vi.fn();
  window.addEventListener("margin:member-updated", changed);
  try {
    const view = render(<PrivateProfile data={data} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete post" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete post",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t delete your post. Try again.",
    );
    expect(screen.getByRole("article", { hidden: true })).toHaveTextContent(
      "Original thought",
    );
    expect(changed).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete post",
      }),
    );
    expect(request).toHaveBeenLastCalledWith(
      "/api/posts/owned-post",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(changed).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    view.rerender(<PrivateProfile data={{ ...data, posts: [] }} />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Recent Posts" }),
      ).toHaveFocus(),
    );
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  } finally {
    window.removeEventListener("margin:member-updated", changed);
  }
});
