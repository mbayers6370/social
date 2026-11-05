"use client";

import Link from "next/link";
import { useRef, useState, type Ref } from "react";
import { Edit, MoreHorizontal, Settings } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileLink } from "./profile-link";

export function ProfileOwnerMenu({
  username,
  name,
  live,
  triggerRef,
  onEdit,
}: {
  username: string;
  name: string;
  live: boolean;
  triggerRef: Ref<HTMLButtonElement>;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const editAfterClose = useRef(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          size="icon"
          className="margin-profile-owner-action"
          aria-label={`More options for ${name}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="margin-member-profile-options"
        onCloseAutoFocus={(event) => {
          if (!editAfterClose.current) return;
          event.preventDefault();
          editAfterClose.current = false;
          onEdit();
        }}
      >
        <DialogHeader>
          <DialogTitle>Profile options</DialogTitle>
          <DialogDescription>Manage your profile.</DialogDescription>
        </DialogHeader>
        <div className="margin-member-profile-options-actions">
          <Button
            variant="outline"
            onClick={() => {
              editAfterClose.current = true;
              setOpen(false);
            }}
          >
            <Edit aria-hidden="true" />
            Edit profile
          </Button>
          <Button variant="outline" asChild>
            <Link
              href={live ? "/app/settings" : "/?view=settings"}
              onClick={() => setOpen(false)}
            >
              <Settings aria-hidden="true" />
              Settings
            </Link>
          </Button>
          {live && username && (
            <ProfileLink key={username} username={username} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
