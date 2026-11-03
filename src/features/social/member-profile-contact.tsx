"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Block,
  Flag,
  Message,
  MoreHorizontal,
} from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SafetyReportButton } from "@/features/safety/report-button";
import { useSpaceClient } from "@/features/spaces/client";
import { MemberFriendActions } from "./member-friend-actions";
import { requestMember, memberJson, memberChanged } from "./member-client";
import type { MemberContact } from "./member-contracts";
export function MemberProfileContact({
  contact,
  viewerId,
  messagingEnabled,
}: {
  contact: MemberContact;
  viewerId: string;
  messagingEnabled: boolean;
}) {
  const client = useSpaceClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="margin-profile-contact">
      <div className="margin-profile-contact-actions">
        <MemberFriendActions
          compact
          person={contact.person}
          relationship={contact.relationship}
        />
        {contact.relationship === "friends" && messagingEnabled && (
          <Button
            variant="outline"
            className="margin-profile-message-action"
            asChild
          >
            <Link
              href={`/app/messages?thread=${encodeURIComponent(contact.person.id)}`}
            >
              <Message aria-hidden="true" />
              Message
            </Link>
          </Button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`More options for ${contact.person.name}`}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent className="margin-member-profile-options">
            <DialogHeader>
              <DialogTitle>Profile options</DialogTitle>
              <DialogDescription>
                Manage how you connect with {contact.person.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="margin-member-profile-options-actions">
              <MemberFriendActions
                person={contact.person}
                relationship={contact.relationship}
              />
              <SafetyReportButton
                viewerId={viewerId}
                local={false}
                target={{
                  kind: "profile",
                  id: contact.person.id,
                  personId: contact.person.id,
                  label: `Profile of ${contact.person.name}`,
                }}
                onReport={async (input) => {
                  await requestMember(
                    client,
                    "/api/reports",
                    memberJson("POST", input),
                  );
                }}
                trigger={
                  <Button variant="outline">
                    <Flag aria-hidden="true" />
                    Report profile
                  </Button>
                }
              />
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setBlocking(true);
                }}
              >
                <Block aria-hidden="true" />
                Block {contact.person.name}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Dialog open={blocking} onOpenChange={setBlocking}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Block {contact.person.name}?</DialogTitle>
            <DialogDescription>
              Friend requests and new messages will stop. Your friend-only posts
              and photographs will be unavailable to each other. Unblocking does
              not restore a friendship.
            </DialogDescription>
          </DialogHeader>
          <div className="margin-form-actions">
            <Button variant="outline" onClick={() => setBlocking(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await requestMember(
                    client,
                    "/api/relationships",
                    memberJson("POST", {
                      targetId: contact.person.id,
                      action: "block",
                    }),
                  );
                  memberChanged();
                  router.replace("/app/friends");
                  router.refresh();
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Couldn’t block this member.",
                  );
                }
              }}
            >
              Block member
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
