"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  Ban,
  CircleHelp,
  Flag,
  Mail,
  MoreHorizontal,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FriendActions } from "@/features/friends/friend-actions";
import { useFriendFeedback } from "@/features/friends/use-friend-feedback";
import { friendStatus } from "@/features/friends/model";
import { usePreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import type { Person } from "@/features/feed/schema";
import { reportReasons, type ReportInput } from "@/features/safety/model";

type Step = "options" | "remove" | "block" | "report" | "report-ready";
function subscribeDesktop(change: () => void) {
  const query = window.matchMedia("(min-width: 1024px)");
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

export function ProfileContactActions({ person }: { person: Person }) {
  const { bootstrap, state, changeFriend, submitReport } = usePreview();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
  const relationship = friendStatus(
    bootstrap.viewerId,
    person.id,
    state.friendships,
  );
  const ownBlock = state.friendships.some(
    (pair) =>
      pair.status === "blocked" &&
      pair.blockedBy === bootstrap.viewerId &&
      pair.people.includes(bootstrap.viewerId) &&
      pair.people.includes(person.id),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [status, setStatus] = useFriendFeedback();
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const lastItem = useRef(false);
  const id = useId();

  function choose(next: Step) {
    setMenuOpen(false);
    setError("");
    setStep(next);
  }
  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => {
      const items =
        menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[lastItem.current ? items.length - 1 : 0]?.focus();
    });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setMenuOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
    };
  }, [menuOpen]);
  useEffect(() => {
    if (!step) return;
    const frame = requestAnimationFrame(() =>
      content.current
        ?.querySelector<HTMLElement>(step === "report" ? "select" : "button")
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    // Preserve the open options when crossing the desktop/mobile breakpoint.
    if ((menuOpen && !desktop) || (step === "options" && desktop)) {
      const frame = requestAnimationFrame(() => {
        setMenuOpen(desktop);
        setStep(desktop ? null : "options");
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [desktop, menuOpen, step]);

  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        []),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const destination =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (destination !== null) {
      event.preventDefault();
      items[destination]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const stops = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href],button,input,select,textarea,[tabindex="0"]',
        ),
      ].filter(
        (node) =>
          node.tabIndex >= 0 &&
          node.getClientRects().length &&
          !menu.current?.contains(node) &&
          !node.hasAttribute("disabled"),
      );
      const next = event.shiftKey
        ? trigger.current
        : stops[stops.indexOf(trigger.current!) + 1];
      setMenuOpen(false);
      next?.focus();
    } else if (event.key === " " && event.target instanceof HTMLAnchorElement) {
      event.preventDefault();
      event.target.click();
    }
  }

  const options = (asMenu: boolean) => (
    <div className="margin-profile-options-list">
      {relationship === "friends" && (
        <Button
          variant="ghost"
          role={asMenu ? "menuitem" : undefined}
          tabIndex={asMenu ? -1 : undefined}
          data-destructive="true"
          onClick={() => choose("remove")}
        >
          <UserMinus aria-hidden="true" />
          Unfriend
        </Button>
      )}
      <Button
        variant="ghost"
        role={asMenu ? "menuitem" : undefined}
        tabIndex={asMenu ? -1 : undefined}
        data-destructive={!ownBlock || undefined}
        onClick={() => choose("block")}
      >
        <Ban aria-hidden="true" />
        {ownBlock ? "Unblock profile" : "Block profile"}
      </Button>
      <Button
        variant="ghost"
        role={asMenu ? "menuitem" : undefined}
        tabIndex={asMenu ? -1 : undefined}
        aria-label="Report profile"
        title="Report profile"
        onClick={() => choose("report")}
      >
        <Flag aria-hidden="true" />
      </Button>
      <Link
        role={asMenu ? "menuitem" : undefined}
        tabIndex={asMenu ? -1 : undefined}
        href="/help"
        onClick={() => {
          setMenuOpen(false);
          setStep(null);
        }}
      >
        <CircleHelp aria-hidden="true" />
        Help &amp; safety
      </Link>
    </div>
  );

  function confirm() {
    try {
      const action =
        step === "remove" ? "remove" : ownBlock ? "unblock" : "block";
      changeFriend(person.id, action);
      setStatus(
        `${person.name} ${action === "remove" ? "removed from friends." : `${action === "block" ? "blocked" : "unblocked"} in this preview.`}`,
      );
      setStep(null);
    } catch (error) {
      setError(previewMessage(error));
    }
  }

  return (
    <div className="margin-profile-contact">
      <div className="margin-profile-contact-actions">
        <FriendActions person={person} compact onStatusChange={setStatus} />
        {relationship === "friends" && (
          <Button
            className="margin-profile-message-action"
            variant="outline"
            size="icon"
            asChild
          >
            <Link
              href={`/?view=messages&thread=${encodeURIComponent(person.id)}`}
              aria-label={`Message ${person.name}`}
              title="Message"
            >
              <Mail aria-hidden="true" strokeWidth={1.5} />
            </Link>
          </Button>
        )}
        <div
          className="margin-profile-overflow"
          ref={root}
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget)
            )
              setMenuOpen(false);
          }}
        >
          <Button
            ref={trigger}
            variant="outline"
            size="icon"
            aria-label={`More options for ${person.name}`}
            title="More options"
            aria-haspopup={desktop ? "menu" : "dialog"}
            aria-expanded={desktop ? menuOpen : step !== null}
            aria-controls={
              menuOpen
                ? `${id}-menu`
                : !desktop && step
                  ? `${id}-dialog`
                  : undefined
            }
            onClick={() => {
              lastItem.current = false;
              if (desktop) setMenuOpen((value) => !value);
              else choose("options");
            }}
            onKeyDown={(event) => {
              if (desktop && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                event.preventDefault();
                lastItem.current = event.key === "ArrowUp";
                setMenuOpen(true);
              }
            }}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
          {menuOpen && (
            <div
              ref={menu}
              id={`${id}-menu`}
              role="menu"
              aria-label={`Options for ${person.name}`}
              className="margin-profile-popover"
              onKeyDown={menuKeys}
            >
              {options(true)}
            </div>
          )}
        </div>
      </div>
      <p role="status" className="margin-status">
        {status}
      </p>
      <Dialog
        open={step !== null}
        onOpenChange={(value) => {
          if (!value) setStep(null);
        }}
      >
        <DialogContent
          ref={content}
          id={`${id}-dialog`}
          role={step === "remove" ? "alertdialog" : "dialog"}
          className={
            step === "options" ? "margin-profile-action-sheet" : undefined
          }
          showCloseButton={step !== "options"}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
        >
          <DialogTitle
            className={
              step === "options" ? "margin-profile-sheet-title" : "pr-8"
            }
          >
            {step === "options"
              ? "Profile options"
              : step === "remove"
                ? `Unfriend ${person.name}?`
                : step === "report"
                  ? `Report ${person.name}`
                  : step === "report-ready"
                    ? "Report saved"
                    : `${ownBlock ? "Unblock" : "Block"} ${person.name}?`}
          </DialogTitle>
          <DialogDescription
            className={
              step === "options"
                ? "margin-profile-sheet-description"
                : undefined
            }
          >
            {step === "options"
              ? person.name
              : step === "remove"
                ? "You’ll no longer see each other’s friend-only posts and photographs. Existing messages stay in your conversation history. You can send a new friend request later."
                : step === "report"
                  ? "Choose a reason and include only the details needed to understand the concern."
                  : step === "report-ready"
                    ? "Your report is saved in this tab and included in your account download. Live moderation is not connected in this preview."
                    : ownBlock
                      ? "Unblocking allows friend requests again. It does not restore your friendship. This change stays in the local preview."
                      : "You’ll be removed from each other’s friends. Friend-only posts, galleries, new messages and friend requests will be unavailable between you. Existing conversation history stays. This change stays in the local preview."}
          </DialogDescription>
          {step === "options" && (
            <>
              {options(false)}
              <Button
                className="margin-profile-sheet-cancel"
                variant="outline"
                onClick={() => setStep(null)}
              >
                Cancel
              </Button>
            </>
          )}
          {(step === "block" || step === "remove") && (
            <div className="margin-form-actions">
              <Button variant="ghost" onClick={() => setStep(null)}>
                Cancel
              </Button>
              <Button
                variant={
                  step === "block" && ownBlock ? "default" : "destructive"
                }
                onClick={confirm}
              >
                {step === "remove"
                  ? "Unfriend"
                  : ownBlock
                    ? "Unblock"
                    : "Block"}
              </Button>
            </div>
          )}
          {step === "report" && (
            <form
              className="margin-profile-report"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  submitReport({
                    target: {
                      kind: "profile",
                      id: person.id,
                      personId: person.id,
                      label: person.name,
                    },
                    reason: String(data.get("reason")) as ReportInput["reason"],
                    details: String(data.get("details") ?? ""),
                  });
                  setStep("report-ready");
                } catch (error) {
                  setError(previewMessage(error));
                }
              }}
            >
              <label htmlFor={`${id}-reason`}>Reason</label>
              <select
                id={`${id}-reason`}
                name="reason"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a reason
                </option>
                {reportReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`${id}-details`}>Details (optional)</label>
              <textarea
                id={`${id}-details`}
                name="details"
                rows={3}
                maxLength={1000}
              />
              <div className="margin-form-actions">
                <Button variant="ghost" onClick={() => setStep(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save report</Button>
              </div>
            </form>
          )}
          {step === "report-ready" && (
            <Button onClick={() => setStep(null)}>Close</Button>
          )}
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
