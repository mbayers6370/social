"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Friends,
  ChevronDown,
  Block,
  Shield,
  Close,
} from "@/components/margin-icons";
import type { SpaceDetails as Data } from "./contracts";
import { useSpaceClient } from "./client";
import { useSpaceAction } from "./use-space-action";
import { SpaceInvitation } from "./space-invitation";
export function SpaceMembers({ data }: { data: Data }) {
  const router = useRouter();
  const client = useSpaceClient();
  const action = useSpaceAction();
  const admin = data.role === "ADMIN";
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const leaveTrigger = useRef<HTMLButtonElement>(null);
  const leaveCancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <details className="margin-space-disclosure margin-space-members">
        <summary>
          <Friends aria-hidden="true" />
          <span>Members</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="margin-space-panel-content">
          <ul className="margin-space-rows">
            {data.members.map((m) => (
              <li key={m.userId} className="margin-space-member-row">
                <span className="margin-space-member-copy">
                  <Link href={client.href(`/app?person=${m.userId}`)}>
                    {m.name}
                  </Link>
                  {(m.role === "ADMIN" || m.rsvp) && (
                    <span className="margin-space-meta">
                      {m.role === "ADMIN" ? "Administrator" : ""}
                      {m.role === "ADMIN" && m.rsvp ? " · " : ""}
                      {m.rsvp
                        ? m.rsvp === "GOING"
                          ? "Going"
                          : m.rsvp === "MAYBE"
                            ? "Maybe"
                            : "Can’t go"
                        : ""}
                    </span>
                  )}
                </span>
                {m.userId !== data.viewerId && (
                  <div
                    className="margin-space-member-actions"
                    role="group"
                    aria-label={`Actions for ${m.name}`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Block ${m.name}`}
                      title={`Block ${m.name}`}
                      disabled={action.busy}
                      onClick={() =>
                        action.run("/api/relationships", "POST", {
                          targetId: m.userId,
                          action: "block",
                        })
                      }
                    >
                      <Block aria-hidden="true" />
                    </Button>
                    {admin &&
                      !data.archivedAt &&
                      m.userId !== data.creatorId && (
                        <>
                          {data.kind !== "EVENT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={
                                m.role === "ADMIN"
                                  ? `Remove administrator role from ${m.name}`
                                  : `Make ${m.name} an administrator`
                              }
                              title={
                                m.role === "ADMIN"
                                  ? `Remove administrator role from ${m.name}`
                                  : `Make ${m.name} an administrator`
                              }
                              aria-pressed={m.role === "ADMIN"}
                              disabled={action.busy}
                              onClick={() =>
                                action.run(
                                  `/api/spaces/${data.id}/members`,
                                  "PATCH",
                                  {
                                    action: "role",
                                    userId: m.userId,
                                    role:
                                      m.role === "ADMIN" ? "MEMBER" : "ADMIN",
                                  },
                                )
                              }
                            >
                              <Shield aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${m.name} from Space`}
                            title={`Remove ${m.name} from Space`}
                            disabled={action.busy}
                            onClick={() =>
                              action.run(
                                `/api/spaces/${data.id}/members`,
                                "PATCH",
                                { action: "remove", userId: m.userId },
                              )
                            }
                          >
                            <Close aria-hidden="true" />
                          </Button>
                        </>
                      )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {data.blockedMembers.length > 0 && (
            <>
              <h2>Members you’ve blocked</h2>
              <ul className="margin-space-rows">
                {data.blockedMembers.map((m) => (
                  <li key={m.id}>
                    <span>{m.name}</span>
                    <Button
                      variant="outline"
                      disabled={action.busy}
                      onClick={() =>
                        action.run("/api/relationships", "POST", {
                          targetId: m.id,
                          action: "unblock",
                        })
                      }
                    >
                      Unblock {m.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {admin && !data.archivedAt && (
            <SpaceInvitation key={data.id} spaceId={data.id} />
          )}
          <Button
            ref={leaveTrigger}
            variant="outline"
            disabled={action.busy}
            onClick={() => setLeaving(true)}
          >
            Leave Space
          </Button>
          {data.kind !== "EVENT" && data.viewerId === data.creatorId && (
            <Button variant="outline" onClick={() => setDeleting(true)}>
              Delete Space
            </Button>
          )}
          {action.error && <p role="alert">{action.error}</p>}
        </div>
      </details>
      <Dialog
        open={leaving}
        onOpenChange={(open) => {
          if (!action.busy) setLeaving(open);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={!action.busy}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            leaveCancel.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            leaveTrigger.current?.focus({ preventScroll: true });
          }}
        >
          <DialogTitle>Leave {data.name}?</DialogTitle>
          <DialogDescription>
            You’ll lose access to this Space and its posts and photographs. Your
            contributions stay for the remaining members.{" "}
            {data.kind === "EVENT"
              ? "You can find and join this Event Space again while it’s open."
              : "You’ll need a new invitation to rejoin. If you’re the last member, this private Space and its content will be deleted."}
            {data.kind !== "EVENT" &&
              data.viewerId === data.creatorId &&
              data.memberCount > 1 &&
              " Another member will take over as administrator."}
          </DialogDescription>
          <Button
            ref={leaveCancel}
            variant="outline"
            disabled={action.busy}
            onClick={() => setLeaving(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={action.busy}
            onClick={async () => {
              if (
                await action.run(
                  `/api/spaces/${data.id}/members`,
                  "PATCH",
                  { action: "remove", userId: data.viewerId },
                  false,
                  { refresh: false },
                )
              ) {
                setLeaving(false);
                router.replace(client.href("/app/spaces"));
              }
            }}
          >
            Leave Space
          </Button>
          {action.error && <p role="alert">{action.error}</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent role="alertdialog">
          <DialogTitle>Delete this Space?</DialogTitle>
          <DialogDescription>
            Its event details, posts and conversations will be deleted for
            everyone. Photographs remain only where another valid post or
            Gallery reference needs them.
          </DialogDescription>
          <Button variant="outline" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button
            disabled={action.busy}
            onClick={async () => {
              if (await action.run(`/api/spaces/${data.id}`, "DELETE"))
                router.push(client.href("/app/spaces"));
            }}
          >
            Delete Space
          </Button>
          {action.error && <p role="alert">{action.error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
