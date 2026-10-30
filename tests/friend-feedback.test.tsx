import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { ProfileContactActions } from "@/features/profile/profile-contact-actions";
import { useFriendFeedback } from "@/features/friends/use-friend-feedback";
import { previewBootstrap } from "./helpers/local-preview-fixture";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function incomingProfile() {
  const data = previewBootstrap();
  data.friendships = [
    { people: ["ines", "theo"], status: "pending", requestedBy: "theo" },
  ];
  return render(
    <PreviewProvider bootstrap={data}>
      <ProfileContactActions person={data.profiles[1].person} />
    </PreviewProvider>,
  );
}
it("clears a decline confirmation after six seconds without changing the resulting relationship", () => {
  incomingProfile();
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  const feedback = screen.getByRole("status");
  expect(feedback).toHaveTextContent(
    "Friend request from Theo Marchetti declined.",
  );
  act(() => vi.advanceTimersByTime(5000));
  expect(feedback).not.toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(1000));
  expect(feedback).toBeEmptyDOMElement();
  expect(screen.getByRole("button", { name: "Add friend" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Accept request" }),
  ).not.toBeInTheDocument();
});
it("gives a newer confirmation its own six seconds and preserves the Request sent label", () => {
  incomingProfile();
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  act(() => vi.advanceTimersByTime(5000));
  fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
  const feedback = screen.getByRole("status");
  act(() => vi.advanceTimersByTime(1000));
  expect(feedback).toHaveTextContent("Friend request sent to Theo Marchetti.");
  act(() => vi.advanceTimersByTime(5000));
  expect(feedback).toBeEmptyDOMElement();
  expect(screen.getByText("Request sent")).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancel request" })).toBeVisible();
});
it("renews repeated confirmations and cancels pending expiry on unmount", () => {
  const { result, unmount } = renderHook(() => useFriendFeedback());
  act(() => result.current[1]("Confirmation"));
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(5000));
  act(() => result.current[1]("Confirmation"));
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current[0]).toBe("Confirmation");
  const showStatus = result.current[1];
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  act(() => showStatus("Late confirmation"));
  expect(vi.getTimerCount()).toBe(0);
});
