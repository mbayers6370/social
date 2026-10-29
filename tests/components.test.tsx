import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { ProfileIdentity } from "@/features/profile/profile-identity";
import {
  ComponentExamples,
  FormExample,
} from "@/app/(development)/design-system/component-examples";

describe("shared component contracts", () => {
  it("discards cancelled profile edits and preserves the saved identity", async () => {
    const user = userEvent.setup();
    function EditableProfile() {
      const [requested, setRequested] = useState(false);
      return (
        <>
          <Button
            className="margin-header-profile"
            onClick={() => setRequested(true)}
          >
            Profile menu
          </Button>
          <ProfileIdentity
            editRequested={requested}
            onEditRequestHandled={() => setRequested(false)}
            profile={{
              person: {
                id: "ines",
                name: "Ines Alvarez",
                initials: "IA",
                tone: "paper",
              },
              handle: "ines",
              bio: "A quiet morning.",
              recent: [],
              photos: [],
            }}
          />
        </>
      );
    }
    render(<EditableProfile />);
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeVisible();
    const edit = screen.getByRole("button", {
      name: "Profile menu",
    });
    await user.click(edit);
    const name = await screen.findByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "An unsaved name");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Ines Alvarez",
    );
    expect(edit).toHaveFocus();
    await user.click(edit);
    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue(
      "Ines Alvarez",
    );
  });

  it("does not submit forms unless explicitly a submit button", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Button>Cancel</Button>
        <Button type="submit">Save</Button>
        <Button asChild>
          <a href="/help">Help</a>
        </Button>
      </form>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.getByRole("link", { name: "Help" })).not.toHaveAttribute(
      "type",
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("associates validation errors with the field, focuses it, and accepts valid input", async () => {
    const user = userEvent.setup();
    render(<FormExample />);
    await user.click(screen.getByRole("button", { name: "Check example" }));
    const input = screen.getByRole("textbox", { name: "Example label" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter at least 2 characters.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      /Use 2–40 characters.*Enter at least 2 characters/,
    );
    expect(input).toHaveFocus();
    await user.type(input, "A clear label");
    await user.click(screen.getByRole("button", { name: "Check example" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Nothing was saved",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("supports opening and closing a Radix dialog by keyboard and restores focus", async () => {
    const user = userEvent.setup();
    render(<ComponentExamples />);
    const trigger = screen.getByRole("button", { name: "Preview dialog" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("dialog", { name: "A little more context" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
