"use client";

import Link from "next/link";
import { ProfileContactActions } from "./profile-contact-actions";
import { ProfilePhotoEditor } from "./profile-photo-editor";
import { Pencil, Settings2 } from "lucide-react";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar } from "@/features/feed/post-content";
import { NewPostButton } from "@/features/compose/new-post-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
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
  const editButton = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);
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
  useEffect(() => {
    if (editing || !returnFocus.current) return;
    returnFocus.current = false;
    const target = trigger.current?.isConnected
      ? trigger.current
      : editButton.current;
    target?.focus({ preventScroll: true });
  }, [editing]);
  function finishEditing() {
    returnFocus.current = true;
    setEditing(false);
  }
  return (
    <header className="margin-profile-identity">
      {editing && !readOnly ? (
        <EditProfileForm
          profile={profile}
          initial={identity}
          onCancel={finishEditing}
          onSave={(value) => {
            onUpdate?.(value);
            setIdentity(value);
            setUpdated(true);
            finishEditing();
          }}
        />
      ) : (
        <>
          <ProfileHeading profile={profile}>
            <h1>{identity.name}</h1>
          </ProfileHeading>
          <p className="margin-profile-bio">{identity.bio}</p>
          {!readOnly ? (
            <div className="margin-profile-actions">
              <NewPostButton />
              <Button
                ref={editButton}
                className="margin-profile-owner-action"
                variant="outline"
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
              <Button
                className="margin-profile-owner-action"
                variant="outline"
                size="icon"
                asChild
              >
                <Link
                  href="/?view=settings"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings2 aria-hidden="true" strokeWidth={1.5} />
                </Link>
              </Button>
            </div>
          ) : (
            <ProfileContactActions person={profile.person} />
          )}
        </>
      )}
      <p role="status" className="margin-status">
        {updated && !editing ? "Profile updated in this preview only." : ""}
      </p>
    </header>
  );
}

function ProfileHeading({
  profile,
  children,
  editing = false,
}: {
  profile: ProfilePreviewData;
  children: ReactNode;
  editing?: boolean;
}) {
  return (
    <div className="margin-profile-heading">
      <div className="margin-profile-portrait">
        <Avatar
          person={profile.person}
          sizes="(min-width: 1024px) 104px, 76px"
        />
        {editing && <ProfilePhotoEditor />}
      </div>
      <div className="margin-profile-name">
        {children}
        <p className="margin-profile-handle">@{profile.handle}</p>
        {editing && (
          <p className="margin-profile-username-hint">
            Your @username is editable in{" "}
            <Link href="/?view=settings#profile-settings">Settings</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

function EditProfileForm({
  profile,
  initial,
  onSave,
  onCancel,
}: {
  profile: ProfilePreviewData;
  initial: ProfileInput;
  onSave: (value: ProfileInput) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: initial,
  });
  const bio = useWatch({ control, name: "bio" });
  const nearLimit = bio.length >= 250;
  useEffect(() => {
    setFocus("name");
  }, [setFocus]);
  return (
    <form
      noValidate
      aria-label="Edit profile"
      className="margin-profile-edit-form"
      onSubmit={handleSubmit(onSave)}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <h1 className="sr-only">Edit profile</h1>
      <ProfileHeading profile={profile} editing>
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
            <FieldError id="profile-name-error">
              {errors.name.message}
            </FieldError>
          )}
        </Field>
      </ProfileHeading>
      <Field className="margin-profile-edit-bio">
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
      <div className="margin-profile-edit-actions">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save changes</Button>
      </div>
      <p className="margin-field-hint">
        Changes stay in this tab and reset when you refresh.
      </p>
    </form>
  );
}
