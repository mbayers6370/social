import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopFriends } from "@/features/profile/top-friends";
import {
  SpaceClientProvider,
  type SpaceClient,
} from "@/features/spaces/client";
import type { Person } from "@/features/feed/schema";
const friends: Person[] = [
  "Alex Example",
  "Morgan With A Longer Name",
  "Casey",
  "Robin",
].map((name, index) => ({
  id: `friend-${index}`,
  name,
  initials: name.slice(0, 2),
  tone: "paper",
}));
let stored: Person[];
let fail: boolean;
let uncertain: boolean;
const request = vi.fn<SpaceClient["request"]>();
const client: SpaceClient = {
  request,
  href: (url) => url,
  photoSrc: (id) => id,
  preview: false,
};
beforeEach(() => {
  stored = [friends[0], friends[1]];
  fail = false;
  uncertain = false;
  request.mockReset().mockImplementation(async (_url, init) => {
    if (init?.method === "PUT") {
      if (uncertain) throw Error("Offline");
      if (fail)
        return Response.json(
          { error: "Choose only accepted friends." },
          { status: 400 },
        );
      const ids: string[] = JSON.parse(String(init.body)).friendIds;
      stored = ids.map((id) => friends.find((person) => person.id === id)!);
      return Response.json({ selected: stored });
    }
    return Response.json({
      selected: stored,
      contacts: friends.map((person) => ({
        person,
        username: "",
        relationship: "friends",
      })),
      nextCursor: null,
    });
  });
});
function show(own = true, people: Person[] | undefined = stored) {
  return render(
    <SpaceClientProvider client={client}>
      <TopFriends own={own} friends={people} />
    </SpaceClientProvider>,
  );
}
describe("Top 4 profile interface", () => {
  it.each([1, 2, 3, 4])(
    "renders %i profile links in the saved order without empty slots",
    (count) => {
      show(false, friends.slice(0, count));
      const card = screen.getByRole("region", { name: "Top 4" });
      expect(
        within(card)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(friends.slice(0, count).map((p) => p.initials + p.name));
      expect(
        within(card)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual(friends.slice(0, count).map((p) => `/app?person=${p.id}`));
      expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    },
  );
  it("renders no box at all when hidden or empty for visitors, with owner editing available when empty", () => {
    const { rerender, container } = show(false, []);
    expect(container).toBeEmptyDOMElement();
    rerender(<TopFriends own friends={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TopFriends own friends={[]} />);
    expect(
      screen.getByRole("button", { name: "Choose your Top 4" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("supports keyboard reordering, removal and addition without saving until Save", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Top 4" });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Move Alex Example right" }),
      ).toBeEnabled(),
    );
    const move = within(dialog).getByRole("button", {
      name: "Move Alex Example right",
    });
    move.focus();
    await user.keyboard("{Enter}");
    expect(
      within(dialog)
        .getAllByRole("button", { name: /^Remove / })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Remove Morgan With A Longer Name", "Remove Alex Example"]);
    await user.click(
      within(dialog).getByRole("button", { name: "Remove Alex Example" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Add Casey" }));
    expect(
      request.mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(0);
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(stored.map((p) => p.id)).toEqual([friends[1].id, friends[2].id]);
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });
  it("Cancel discards unsaved selections and restores trigger focus", async () => {
    const user = userEvent.setup();
    show();
    const trigger = screen.getByRole("button", { name: "Edit" });
    await user.click(trigger);
    await screen.findByRole("button", { name: "Remove Alex Example" });
    await user.click(
      screen.getByRole("button", { name: "Remove Alex Example" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(stored).toHaveLength(2);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
  });
  it("retains the draft on validation errors, and retries uncertain saves with the same request ID", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("button", { name: "Remove Alex Example" });
    await user.click(
      screen.getByRole("button", { name: "Remove Alex Example" }),
    );
    fail = true;
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose only accepted friends.",
    );
    expect(
      screen.getByRole("button", { name: "Remove Morgan With A Longer Name" }),
    ).toBeEnabled();
    fail = false;
    uncertain = true;
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Retry Save"),
    );
    expect(
      screen.getByRole("button", { name: "Remove Morgan With A Longer Name" }),
    ).toBeDisabled();
    uncertain = false;
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const attempts = request.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(new Set(attempts.map((attempt) => attempt.requestId)).size).toBe(1);
  });
  it("searches through the existing authenticated transport and limits the draft to four", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("button", { name: "Add Casey" });
    await user.click(screen.getByRole("button", { name: "Add Casey" }));
    await user.click(screen.getByRole("button", { name: "Add Robin" }));
    expect(
      screen.getByRole("button", { name: "Move Robin right" }),
    ).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "Search your friends" }),
      "Robin",
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/api/profiles/me/top-friends?q=Robin",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
  });
});
