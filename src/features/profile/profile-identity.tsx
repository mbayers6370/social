"use client";

import Link from "next/link";
import { ProfileContactActions } from "./profile-contact-actions";
import { Pencil, Settings2 } from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar } from "@/features/feed/post-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  profileInputSchema,
  type ProfileInput,
  type ProfilePreviewData,
} from "./schema";

export function ProfileIdentity({
  profile,
  readOnly = false,
  onUpdate,
  editRequested = false,
  onEditRequestHandled,
}: {
  profile: ProfilePreviewData;
  readOnly?: boolean;
  onUpdate?: (value: ProfileInput) => void;
  editRequested?: boolean;
  onEditRequestHandled?: () => void;
}) {
  const [identity, setIdentity] = useState<ProfileInput>({
    name: profile.person.name,
    bio: profile.bio,
  });
  const [editing, setEditing] = useState(false);
  const [updated, setUpdated] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!editRequested || readOnly) return;
    const frame = requestAnimationFrame(() => {
      trigger.current = document.querySelector<HTMLButtonElement>(
        ".margin-header-profile",
      );
      setEditing(true);
      onEditRequestHandled?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [editRequested, readOnly, onEditRequestHandled]);
  function restoreFocus(event: Event) {
    event.preventDefault();
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <header className="margin-profile-identity">
      <div className="margin-profile-heading">
        <Avatar
          person={profile.person}
          sizes="(min-width: 1024px) 104px, 76px"
        />
        <div className="margin-profile-name">
          <h1>{identity.name}</h1>
          <p className="margin-profile-handle">@{profile.handle}</p>
        </div>
      </div>
      <p className="margin-profile-bio">{identity.bio}</p>
      {!readOnly ? (
        <div className="margin-profile-actions">
          <Button
            className="margin-profile-owner-action"
            size="icon"
            aria-label="Edit profile"
            title="Edit profile"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" strokeWidth={1.5} />
          </Button>
          <Button className="margin-profile-owner-action" size="icon" asChild>
            <Link href="/?view=settings" aria-label="Settings" title="Settings">
              <Settings2 aria-hidden="true" strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
      ) : (
        <ProfileContactActions person={profile.person} />
      )}
      <p role="status" className="margin-status">
        {updated ? "Profile updated in this preview only." : ""}
      </p>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Try a name and bio in this local preview. Changes stay in this tab
              and reset when you refresh.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EditProfileForm
              initial={identity}
              onCancel={() => setEditing(false)}
              onSave={(value) => {
                onUpdate?.(value);
                setIdentity(value);
                setUpdated(true);
                setEditing(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}

function EditProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ProfileInput;
  onSave: (value: ProfileInput) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: initial,
  });
  const bio = useWatch({ control, name: "bio" });
  const nearLimit = bio.length >= 250;
  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit(onSave)}>
      <Field>
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          {...register("name")}
          maxLength={80}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "profile-name-error" : undefined}
        />
        {errors.name && (
          <FieldError id="profile-name-error">{errors.name.message}</FieldError>
        )}
      </Field>
      <Field>
        <Label htmlFor="profile-bio">Bio</Label>
        <textarea
          data-field
          className="margin-profile-bio-input"
          id="profile-bio"
          {...register("bio")}
          maxLength={300}
          rows={4}
          aria-invalid={Boolean(errors.bio)}
          aria-describedby={
            [
              nearLimit && "profile-bio-count",
              errors.bio && "profile-bio-error",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {nearLimit && (
          <p id="profile-bio-count" className="margin-field-hint" role="status">
            {300 - bio.length} characters remaining
          </p>
        )}
        {errors.bio && (
          <FieldError id="profile-bio-error">{errors.bio.message}</FieldError>
        )}
      </Field>
      <div className="margin-form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save preview</Button>
      </div>
    </form>
  );
}
