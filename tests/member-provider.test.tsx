import { Component, useState, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MemberProvider, useMember } from "@/features/social/member-provider";
import { SpaceClientProvider } from "@/features/spaces/client";
import { sampleIdentity } from "@/features/social/member-preview";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>Provider crashed</p> : this.props.children;
  }
}

function Probe() {
  const member = useMember()!;
  const [error, setError] = useState("");
  return (
    <>
      <p>{member.identity.person.name}</p>
      <button
        onClick={async () => {
          setError("");
          try {
            await member.reload();
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Refresh failed",
            );
          }
        }}
      >
        Reload identity
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

it.each([
  ["null JSON", () => Response.json(null)],
  [
    "HTML returned with 200",
    () =>
      new Response("<html>Not JSON</html>", {
        headers: { "Content-Type": "text/html" },
      }),
  ],
  [
    "missing preferences",
    () => Response.json({ ...sampleIdentity, preferences: null }),
  ],
])(
  "keeps the last valid identity after %s and recovers on the next read",
  async (_label, response) => {
    const user = userEvent.setup();
    const request = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockImplementation(async () =>
        Response.json({
          ...sampleIdentity,
          person: { ...sampleIdentity.person, name: "Refreshed member" },
          preferences: {
            ...sampleIdentity.preferences,
            readingSize: "larger",
            motion: "reduced",
          },
        }),
      );
    render(
      <Boundary>
        <SpaceClientProvider
          client={{
            request,
            href: (url) => url,
            photoSrc: (id) => id,
            preview: false,
          }}
        >
          <MemberProvider initial={sampleIdentity}>
            <Probe />
          </MemberProvider>
        </SpaceClientProvider>
      </Boundary>,
    );
    await user.click(screen.getByRole("button", { name: "Reload identity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    expect(screen.getByText(sampleIdentity.person.name)).toBeVisible();
    expect(screen.queryByText("Provider crashed")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload identity" }));
    expect(await screen.findByText("Refreshed member")).toBeVisible();
    expect(document.documentElement).toHaveAttribute(
      "data-reading-size",
      "larger",
    );
    expect(document.documentElement).toHaveAttribute("data-motion", "reduced");
  },
);
