"use client";
import { createRequestId } from "@/lib/local-id";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Friends } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccountSession } from "@/components/auth/account-session";
import { POSTING_TIME_ZONE } from "@/lib/platform-rules";

type Invitation = {
  id: string;
  url: string;
  expiresAt: string;
  community?: boolean;
  label?: string | null;
  revoked?: boolean;
  accepted?: number;
  maximum?: number;
};
type Summary = {
  founder: boolean;
  remaining: number;
  nextCursor?: string | null;
  links: Invitation[];
};

function isActive(link: Invitation) {
  return (
    !link.revoked &&
    new Date(link.expiresAt).getTime() > Date.now() &&
    (link.accepted ?? 0) < (link.maximum ?? 1)
  );
}
const invitationDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: POSTING_TIME_ZONE,
});
function linkStatus(link: Invitation) {
  if (link.revoked) return "Withdrawn";
  if ((link.accepted ?? 0) >= (link.maximum ?? 1)) return "Accepted";
  if (new Date(link.expiresAt).getTime() <= Date.now()) return "Expired";
  return `Expires ${invitationDate.format(new Date(link.expiresAt))}`;
}
async function call(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    ...init,
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Invitations are unavailable. Please try again.");
  return data;
}

export function InviteFriends() {
  const session = useAccountSession();
  return <InvitationManager available={Boolean(session?.managed)} />;
}

/** Presentation only: every API independently requires an ACTIVE server account. */
export function InvitationManager({ available }: { available: boolean }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [community, setCommunity] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const disclosureId = useId();
  const [sharedIds, setSharedIds] = useState<Set<string>>(() => new Set());
  const requestId = useRef<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const pendingCopyFocus = useRef(false);
  const working = useRef(false);
  const loading = useRef(false);
  const revision = useRef(0);
  const loadedCount = useRef(0);

  useEffect(() => {
    if (!busy && pendingCopyFocus.current) {
      pendingCopyFocus.current = false;
      copyButton.current?.focus();
    }
  }, [busy, invitation]);

  // Refresh the pages already being read without collapsing older invitations.
  const fetchSummary = useCallback(async () => {
    let updated: Summary = await call("/api/invitations");
    const target = loadedCount.current;
    const cursors = new Set<string>();
    while (updated.nextCursor && updated.links.length < target) {
      const cursor = updated.nextCursor;
      if (cursors.has(cursor)) throw Error("Couldn’t refresh invitations.");
      cursors.add(cursor);
      const next: Summary = await call(
        `/api/invitations?before=${encodeURIComponent(cursor)}`,
      );
      updated = { ...next, links: [...updated.links, ...next.links] };
    }
    return updated;
  }, []);

  const load = useCallback(
    async ({ foreground = false, choose = false } = {}) => {
      if (working.current || loading.current) return;
      loading.current = true;
      const currentRevision = revision.current;
      if (foreground) {
        working.current = true;
        setBusy(true);
        setError("");
      }
      try {
        const updated = await fetchSummary();
        if (revision.current !== currentRevision) return;
        loadedCount.current = updated.links.length;
        setSummary(updated);
        setInvitation((current) =>
          current
            ? (updated.links.find((link) => link.id === current.id) ?? current)
            : choose
              ? (updated.links.find(
                  (link) => !link.community && isActive(link),
                ) ?? null)
              : null,
        );
      } catch (failure) {
        // Quiet refreshes retain the last known list when temporarily offline.
        if (foreground)
          setError(
            failure instanceof Error
              ? failure.message
              : "Couldn’t load invitations.",
          );
      } finally {
        loading.current = false;
        if (foreground) {
          working.current = false;
          setBusy(false);
        }
      }
    },
    [fetchSummary],
  );

  useEffect(() => {
    if (!open || !available) return;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 15_000);
    const deadlines =
      summary?.links
        .filter(isActive)
        .map((link) => new Date(link.expiresAt).getTime()) ?? [];
    const delay = Math.min(...deadlines) - Date.now();
    const deadline = deadlines.length
      ? window.setTimeout(refresh, Math.min(Math.max(0, delay), 2_147_483_647))
      : undefined;
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
      window.clearTimeout(deadline);
    };
  }, [open, available, summary, load]);

  async function create(): Promise<Invitation> {
    requestId.current ??= createRequestId();
    const fields = form.current ? new FormData(form.current) : null;
    const data: Invitation = await call("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestId.current,
        community,
        label: String(fields?.get("label") || ""),
        ...(community
          ? {
              maxRedemptions: Number(fields?.get("maximum") || 10),
              ...(fields?.get("expires")
                ? {
                    expiresAt: new Date(
                      String(fields.get("expires")),
                    ).toISOString(),
                  }
                : {}),
            }
          : {}),
      }),
    });
    setInvitation(data);
    requestId.current = null;
    const updated = await fetchSummary().catch(() => null);
    if (updated) {
      loadedCount.current = updated.links.length;
      setSummary(updated);
    }
    return data;
  }
  function markShared(id: string) {
    setSharedIds((current) =>
      current.has(id) ? current : new Set([...current, id]),
    );
  }
  async function share(link: Invitation, copy = false) {
    if (!copy && navigator.share) {
      try {
        await navigator.share({
          title: "An invitation to Margin",
          text: "I’d like to invite you to Margin. A little of our days, with room for everything else.",
          url: link.url,
        });
        markShared(link.id);
        setStatus("Invitation shared.");
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError")
          return;
        setStatus(
          "Sharing didn’t work. Try Share again, or copy the link above.",
        );
      }
    } else {
      try {
        await navigator.clipboard.writeText(link.url);
        markShared(link.id);
        setStatus("Invitation link copied.");
      } catch {
        setStatus("Select and copy the link above.");
      }
    }
  }
  async function perform(action: () => Promise<unknown>) {
    if (working.current) return;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t complete the invitation. Please try again.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const canCreate = Boolean(
    summary && (summary.founder || summary.remaining > 0),
  );
  const active = invitation ? isActive(invitation) : false;
  const listedInvitations =
    summary?.links.filter((link) => !link.revoked) ?? [];
  const canInviteAnother =
    invitation &&
    canCreate &&
    (sharedIds.has(invitation.id) || !active || (invitation.accepted ?? 0) > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && available) void load({ foreground: true, choose: true });
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Friends aria-hidden="true" />
          Invite someone
        </Button>
      </DialogTrigger>
      <DialogContent className="margin-invitation-dialog">
        <DialogTitle className="margin-invitation-title">
          Invite someone to Margin
        </DialogTitle>
        <DialogDescription className={available ? "sr-only" : undefined}>
          {available
            ? "Copy or share an invitation link to Margin."
            : "Your three invitations become available when you finish joining. This preview doesn’t issue live invitations."}
        </DialogDescription>
        {available && (
          <>
            {invitation && (
              <>
                <div className="margin-invitation-link">
                  <Label className="sr-only" htmlFor="invitation-link">
                    Your invitation link
                  </Label>
                  <Input
                    id="invitation-link"
                    value={invitation.url}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    onCopy={() => markShared(invitation.id)}
                  />
                  <p className="margin-field-hint">
                    {linkStatus(invitation)}
                    {active &&
                      (invitation.community
                        ? " · Only verified, completed claims count toward its limit."
                        : " · One person can join with this link.")}
                  </p>
                </div>
                <div className="margin-invitation-actions">
                  <Button
                    ref={copyButton}
                    disabled={busy || !active}
                    onClick={() => void perform(() => share(invitation, true))}
                  >
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !active}
                    onClick={() => void perform(() => share(invitation))}
                  >
                    Share
                  </Button>
                </div>
              </>
            )}
            {status && (
              <p className="margin-invitation-feedback" role="status">
                {status}
              </p>
            )}
            {summary && !invitation && (
              <form
                ref={form}
                className="margin-account-form"
                onSubmit={(event) => event.preventDefault()}
              >
                {summary.founder && (
                  <label className="margin-account-confirmation">
                    <input
                      type="checkbox"
                      checked={community}
                      disabled={busy}
                      onChange={(event) => {
                        setCommunity(event.target.checked);
                        requestId.current = null;
                        setStatus("");
                      }}
                    />
                    Create a community invitation
                  </label>
                )}
                <Label htmlFor="invitation-label">
                  {community
                    ? "Campaign label (optional)"
                    : "Who’s this for? (optional)"}
                </Label>
                <Input
                  id="invitation-label"
                  name="label"
                  placeholder={community ? undefined : "e.g. Sam"}
                  maxLength={80}
                  disabled={busy || !canCreate}
                />
                {community && (
                  <>
                    <Label htmlFor="invitation-maximum">
                      People who can join
                    </Label>
                    <Input
                      id="invitation-maximum"
                      name="maximum"
                      type="number"
                      min={1}
                      max={10000}
                      defaultValue={10}
                      disabled={busy}
                    />
                    <Label htmlFor="invitation-expires">
                      Expiration (optional, up to 30 days)
                    </Label>
                    <Input
                      id="invitation-expires"
                      name="expires"
                      type="datetime-local"
                      disabled={busy}
                    />
                  </>
                )}
              </form>
            )}
            {!invitation && (
              <div className="margin-invitation-actions">
                <Button
                  disabled={busy || !canCreate}
                  onClick={() =>
                    void perform(async () => {
                      await create();
                      pendingCopyFocus.current = true;
                    })
                  }
                >
                  {busy ? "Please wait…" : "Create invitation link"}
                </Button>
              </div>
            )}
            {canInviteAnother && (
              <Button
                variant="link"
                className="margin-invitation-next"
                disabled={busy}
                onClick={() => {
                  setInvitation(null);
                  requestId.current = null;
                  setStatus("");
                }}
              >
                Invite another person
              </Button>
            )}
            {summary && (
              <div className="margin-invitation-info">
                <div className="margin-invitation-availability">
                  <p role="status">
                    {summary.founder
                      ? "Unlimited invitations"
                      : `${summary.remaining} of 3 invitations left`}
                  </p>
                  <button
                    type="button"
                    className="margin-invitation-text-action"
                    aria-expanded={helpOpen}
                    aria-controls={`${disclosureId}-help`}
                    onClick={() => setHelpOpen(!helpOpen)}
                  >
                    How invitations work
                  </button>
                </div>
                <div
                  id={`${disclosureId}-help`}
                  hidden={!helpOpen}
                  className="margin-invitation-help"
                >
                  <p>
                    Each personal link lets one person join and lasts 30 days.
                    Joining doesn’t automatically make you friends.
                  </p>
                  {!summary.founder && (
                    <p>
                      You can have three active invitations at a time. When
                      someone accepts your invitation and finishes joining, that
                      slot becomes available again. Expired or withdrawn links
                      also free a slot.
                    </p>
                  )}
                  <p>
                    You can share the same active link again without using
                    another slot.
                  </p>
                </div>
              </div>
            )}
            {summary &&
              (listedInvitations.length > 0 || summary.nextCursor) && (
                <section
                  className="margin-invitation-history"
                  aria-label="Your invitations"
                >
                  <div className="margin-invitation-history-heading">
                    <h3>Your invitations</h3>
                    <button
                      type="button"
                      className="margin-invitation-text-action"
                      aria-expanded={historyOpen}
                      aria-controls={`${disclosureId}-history`}
                      onClick={() => setHistoryOpen(!historyOpen)}
                    >
                      {historyOpen ? "Hide" : "Show"}
                    </button>
                  </div>
                  <ul
                    id={`${disclosureId}-history`}
                    hidden={!historyOpen}
                    className="margin-invitation-list"
                  >
                    {listedInvitations.map((link) => {
                      const ended = !isActive(link);
                      return (
                        <li key={link.id}>
                          <div className="margin-invitation-list-copy">
                            <p>
                              {link.community
                                ? link.label || "Community invitation"
                                : link.label
                                  ? `For ${link.label}`
                                  : "Personal invitation"}
                            </p>
                            <p className="margin-invitation-meta">
                              {!ended && "Active · "}
                              {linkStatus(link)}
                              {link.community &&
                                ` · ${link.accepted ?? 0} of ${link.maximum ?? 1} accepted`}
                            </p>
                          </div>
                          <div className="margin-invitation-actions">
                            {!ended && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => {
                                  pendingCopyFocus.current = true;
                                  setInvitation(link);
                                  setStatus("");
                                }}
                              >
                                Show link
                              </Button>
                            )}
                            {!ended && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  void perform(async () => {
                                    await call(`/api/invitations/${link.id}`, {
                                      method: "DELETE",
                                    });
                                    if (invitation?.id === link.id)
                                      setInvitation(null);
                                    const updated = await fetchSummary();
                                    loadedCount.current = updated.links.length;
                                    setSummary(updated);
                                    const withdrawn = summary.founder
                                      ? "Invitation withdrawn."
                                      : "Invitation withdrawn. Its slot is available again.";
                                    setStatus(withdrawn);
                                  })
                                }
                              >
                                Withdraw invitation
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            {historyOpen && summary?.nextCursor && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const next: Summary = await call(
                      `/api/invitations?before=${encodeURIComponent(summary.nextCursor!)}`,
                    );
                    const updated = {
                      ...next,
                      links: [...summary.links, ...next.links],
                    };
                    loadedCount.current = updated.links.length;
                    setSummary(updated);
                  })
                }
              >
                Older invitations
              </Button>
            )}
            {!summary && !busy && (
              <Button
                variant="outline"
                onClick={() => void load({ foreground: true, choose: true })}
              >
                Retry loading invitations
              </Button>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
