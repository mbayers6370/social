"use client";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { useSpaceClient } from "@/features/spaces/client";
import { memberJson, requestMember } from "@/features/social/member-client";
import { eventSpacesEnabled } from "@/features/spaces/availability";

type Report = {
  id: string;
  reason: string;
  details: string;
  targetKind: string;
  targetId: string;
  status: string;
  createdAt: string;
  review: { action: string; note: string } | null;
};
type Target = { body: string; photos: string[] } | null;
export function ModerationQueue({
  initial,
  initialCursor,
}: {
  initial: Report[];
  initialCursor: string | null;
}) {
  const client = useSpaceClient();
  const [reports, setReports] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await requestMember<{
        reports: Report[];
        nextCursor: string | null;
      }>(
        client,
        `/api/moderation/reports?before=${encodeURIComponent(cursor)}`,
      );
      setReports((current) => [
        ...current,
        ...next.reports.filter(
          (report) => !current.some((existing) => existing.id === report.id),
        ),
      ]);
      setCursor(next.nextCursor);
    } catch {
      setError("Reports could not be loaded. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <LiveAppShell active="profile">
      <section className="margin-settings-page">
        <h1>Safety reports</h1>
        <p>
          Founder review is limited to reported items. Deleted or expired
          content is unavailable. Decisions are recorded with your identity and
          reason.
        </p>
        {!reports.length && <p>No reports received.</p>}
        {reports.map((report) => (
          <ReportReview
            key={report.id}
            report={report}
            onReviewed={(status) =>
              setReports((current) =>
                current.map((row) =>
                  row.id === report.id ? { ...row, status } : row,
                ),
              )
            }
          />
        ))}
        {cursor && (
          <Button variant="outline" disabled={busy} onClick={more}>
            Load more reports
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
        {eventSpacesEnabled && <EventAdministrator />}
      </section>
    </LiveAppShell>
  );
}

function ReportReview({
  report,
  onReviewed,
}: {
  report: Report;
  onReviewed: (status: string) => void;
}) {
  const client = useSpaceClient();
  const [target, setTarget] = useState<Target>();
  const [action, setAction] = useState("DISMISS");
  const [photoId, setPhotoId] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setTarget(
        (
          await requestMember<{ target: Target }>(
            client,
            `/api/moderation/reports/${report.id}`,
          )
        ).target,
      );
    } catch {
      setError("Reported content could not be loaded. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestMember<{ status: string }>(
        client,
        `/api/moderation/reports/${report.id}`,
        memberJson("PATCH", {
          action,
          note,
          ...(action === "REMOVE_PHOTO" ? { photoId } : {}),
        }),
      );
      onReviewed(result.status);
      setTarget(undefined);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The decision could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>
        {report.targetKind} · {report.reason} · {report.status}
      </summary>
      <p>{report.details || "No additional details."}</p>
      {report.review && (
        <p>
          {report.review.action}: {report.review.note}
        </p>
      )}
      <Button variant="outline" disabled={busy} onClick={load}>
        Review reported item
      </Button>
      {target === null && <p>The reported item is no longer available.</p>}
      {target && (
        <>
          <blockquote>{target.body}</blockquote>
          {target.photos.map((id) => (
            <figure key={id}>
              <Image
                src={`/api/moderation/reports/${report.id}/photo?photoId=${encodeURIComponent(id)}`}
                alt="Photograph attached to this report"
                width={600}
                height={400}
                unoptimized
                className="margin-post-image"
              />
              <figcaption>Photo ID: {id}</figcaption>
            </figure>
          ))}
        </>
      )}
      {report.status === "RECEIVED" && (
        <form onSubmit={submit}>
          <label>
            Disposition
            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setConfirmed(false);
              }}
            >
              <option value="DISMISS">Dismiss — no enforcement</option>
              {report.targetKind === "post" && (
                <option value="REMOVE_POST">
                  Remove this post (preserve photos used elsewhere)
                </option>
              )}
              {report.targetKind === "message" && (
                <option value="REMOVE_MESSAGE">
                  Remove this message for both participants
                </option>
              )}
              {!!target?.photos.length && (
                <option value="REMOVE_PHOTO">
                  Remove an attached photo everywhere
                </option>
              )}
              <option value="DEACTIVATE_ACCOUNT">
                Deactivate the reported account
              </option>
            </select>
          </label>
          {action === "REMOVE_PHOTO" && (
            <label>
              Reported photo
              <select
                required
                value={photoId}
                onChange={(event) => setPhotoId(event.target.value)}
              >
                <option value="">Choose a photo</option>
                {target?.photos.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Decision reason
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I have reviewed this report and confirm this disposition.
          </label>
          <Button type="submit" disabled={busy || !confirmed}>
            Record decision
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}

function EventAdministrator() {
  const client = useSpaceClient();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details>
      <summary>Assign an Event Space administrator</summary>
      <p>
        Only a founder can grant or remove this role. The account must already
        be an active member of the public Event Space.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setStatus("");
          try {
            await requestMember(
              client,
              `/api/moderation/events/${encodeURIComponent(String(data.get("spaceId")))}/administrator`,
              memberJson("PATCH", {
                userId: data.get("userId"),
                role: data.get("role"),
                note: data.get("note"),
              }),
            );
            setStatus("Administrator assignment saved.");
          } catch (error) {
            setStatus(
              error instanceof Error
                ? error.message
                : "Assignment could not be saved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Event Space ID
          <input name="spaceId" required maxLength={128} />
        </label>
        <label>
          Member ID
          <input name="userId" required maxLength={128} />
        </label>
        <label>
          Role
          <select name="role">
            <option value="ADMIN">Administrator</option>
            <option value="MEMBER">Member</option>
          </select>
        </label>
        <label>
          Assignment reason
          <textarea name="note" required maxLength={1000} rows={3} />
        </label>
        <Button type="submit" disabled={busy}>
          Save assignment
        </Button>
      </form>
      <p role="status">{status}</p>
    </details>
  );
}
