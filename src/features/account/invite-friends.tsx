"use client";
import { useRef, useState, type FormEvent } from "react";
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
  const [emailMode, setEmailMode] = useState(false);
  const [community, setCommunity] = useState(false);
  const requestId = useRef<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  async function call(url: string, init?: RequestInit) {
    const response = await fetch(url, { cache: "no-store", ...init });
    const data = await response.json();
    if (!response.ok)
      throw Error(
        data.error || "Invitations are unavailable. Please try again.",
      );
    return data;
  }
  async function load() {
    setBusy(true);
    setError("");
    try {
      setSummary(await call("/api/invitations"));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t load invitations.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(email?: string): Promise<Invitation> {
    if (invitation && !community) return invitation;
    requestId.current ??= crypto.randomUUID();
    const fields = form.current ? new FormData(form.current) : null;
    const data = await call("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestId.current,
        community,
        ...(community
          ? {
              label: String(fields?.get("label") || ""),
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
        ...(email ? { email } : {}),
      }),
    });
    setInvitation(data);
    requestId.current = null;
    const updated = await call("/api/invitations").catch(() => null);
    setSummary(updated);
    return data;
  }
  async function share(link: Invitation, copy = false) {
    const text =
      "I’d like to invite you to Margin. A little of our days, with room for everything else.";
    if (!copy && navigator.share) {
      try {
        await navigator.share({
          title: "An invitation to Margin",
          text,
          url: link.url,
        });
        setStatus("Invitation shared.");
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError")
          return;
        setStatus(
          "Your invitation is ready. Tap Share invitation again, or copy the link below.",
        );
      }
    } else {
      try {
        await navigator.clipboard.writeText(link.url);
        setStatus("Invitation link copied.");
      } catch {
        setStatus("Your invitation is ready. Select and copy the link below.");
      }
    }
  }
  async function perform(action: () => Promise<unknown>) {
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
      setBusy(false);
    }
  }
  const canCreate = Boolean(
    summary && (summary.founder || summary.remaining > 0),
  );
  async function email(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = String(new FormData(event.currentTarget).get("email"));
    await perform(async () => {
      if (invitation)
        await call(
          `/api/invite/${new URL(invitation.url).pathname.split("/").pop()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: address }),
          },
        );
      else await create(address);
      setStatus(
        "Personal invitation requested. Ask your friend to check their inbox.",
      );
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && available) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Friends aria-hidden="true" />
          Invite someone
        </Button>
      </DialogTrigger>
      <DialogContent className="margin-invitation-dialog">
        <DialogTitle>A small circle starts here.</DialogTitle>
        <DialogDescription>
          {available
            ? "Send a personal invitation by text or your favorite messaging app. Links last 30 days. Joining doesn’t automatically make you friends."
            : "Your three invitations become available when you finish joining. This preview doesn’t issue live invitations."}
        </DialogDescription>
        {available && (
          <>
            {summary && (
              <p role="status">
                {summary.founder
                  ? "Founder · Unlimited invitations"
                  : `${summary.remaining} of 3 invitations remaining · No expiration on your allowance`}
              </p>
            )}
            {summary?.founder && (
              <form
                ref={form}
                className="margin-account-form"
                onSubmit={(event) => event.preventDefault()}
              >
                <label className="margin-account-confirmation">
                  <input
                    type="checkbox"
                    checked={community}
                    disabled={busy}
                    onChange={(event) => {
                      setCommunity(event.target.checked);
                      setInvitation(null);
                      requestId.current = null;
                    }}
                  />
                  Create a community invitation
                </label>
                {community && (
                  <>
                    <Label htmlFor="invitation-label">
                      Campaign label (optional)
                    </Label>
                    <Input
                      id="invitation-label"
                      name="label"
                      maxLength={80}
                      disabled={busy}
                    />
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
            <div className="margin-invitation-actions">
              <Button
                disabled={busy || (!invitation && !canCreate)}
                onClick={() =>
                  void perform(async () =>
                    share(invitation ?? (await create())),
                  )
                }
              >
                {busy ? "Please wait…" : "Share invitation"}
              </Button>
              <Button
                variant="outline"
                disabled={busy || (!invitation && !canCreate)}
                onClick={() =>
                  void perform(async () =>
                    share(invitation ?? (await create()), true),
                  )
                }
              >
                Copy link
              </Button>
              <Button
                variant="ghost"
                disabled={busy || (!invitation && !canCreate)}
                onClick={() => setEmailMode(!emailMode)}
              >
                Invite by email
              </Button>
            </div>
            {!invitation && canCreate && (
              <p className="margin-field-hint">
                Creating a personal link uses one invitation, even if it isn’t
                accepted. Sharing it again uses no more.
              </p>
            )}
            {invitation && canCreate && (
              <Button
                variant="ghost"
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
            {invitation && (
              <div className="margin-invitation-link">
                <Label htmlFor="invitation-link">Your invitation link</Label>
                <Input
                  id="invitation-link"
                  value={invitation.url}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
                <p className="margin-field-hint">
                  Expires {new Date(invitation.expiresAt).toLocaleDateString()}.{" "}
                  {(invitation.community ?? community)
                    ? "Only verified, completed claims count toward its limit."
                    : "One person can join with this link."}
                </p>
              </div>
            )}
            {emailMode && (
              <form className="margin-account-form" onSubmit={email}>
                <Label htmlFor="friend-email">Their email address</Label>
                <Input
                  id="friend-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={busy}
                />
                <Button type="submit" disabled={busy}>
                  Send personal invitation
                </Button>
              </form>
            )}
            {summary && !summary.founder && summary.remaining === 0 && (
              <p>
                Your three invitations have been issued. You can still share an
                available link below.
              </p>
            )}
            {summary && summary.links.length > 0 && (
              <details>
                <summary>Your invitations</summary>
                <ul className="margin-invitation-list">
                  {summary.links.map((link) => {
                    const ended =
                      link.revoked ||
                      new Date(link.expiresAt) <= new Date() ||
                      (link.accepted ?? 0) >= (link.maximum ?? 1);
                    return (
                      <li key={link.id}>
                        <p>
                          {link.label ||
                            (link.community
                              ? "Community invitation"
                              : "Personal invitation")}{" "}
                          ·{" "}
                          {link.revoked
                            ? "Withdrawn"
                            : new Date(link.expiresAt) <= new Date()
                              ? "Expired"
                              : `${link.accepted ?? 0} of ${link.maximum ?? 1} accepted`}
                        </p>
                        <div className="margin-invitation-actions">
                          {!ended && (
                            <>
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setInvitation(link);
                                  void perform(() => share(link));
                                }}
                              >
                                Share invitation
                              </Button>
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setInvitation(link);
                                  void perform(() => share(link, true));
                                }}
                              >
                                Copy link
                              </Button>
                            </>
                          )}
                          {!link.revoked && (
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void perform(async () => {
                                  const result = await call(
                                    `/api/invitations/${link.id}`,
                                    { method: "DELETE" },
                                  );
                                  if (invitation?.id === link.id)
                                    setInvitation(null);
                                  setSummary(await call("/api/invitations"));
                                  setStatus(
                                    result.providerPending
                                      ? "Invitation withdrawn. Margin access is blocked; email-link revocation is waiting for Clerk. Retry withdrawal to check again."
                                      : "Invitation withdrawn. This does not restore your allowance.",
                                  );
                                })
                              }
                            >
                              Withdraw invitation
                            </Button>
                          )}
                          {link.revoked && (
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void perform(async () => {
                                  const result = await call(
                                    `/api/invitations/${link.id}`,
                                    { method: "DELETE" },
                                  );
                                  setStatus(
                                    result.providerPending
                                      ? "Margin access remains blocked. Clerk cleanup is still pending."
                                      : "Withdrawal is complete in Margin and Clerk.",
                                  );
                                })
                              }
                            >
                              Check withdrawal
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
            {summary?.nextCursor && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const next: Summary = await call(
                      `/api/invitations?before=${encodeURIComponent(summary.nextCursor!)}`,
                    );
                    setSummary({
                      ...next,
                      links: [...summary.links, ...next.links],
                    });
                  })
                }
              >
                Older invitations
              </Button>
            )}
            {!summary && !busy && (
              <Button variant="outline" onClick={() => void load()}>
                Retry loading invitations
              </Button>
            )}
          </>
        )}
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
