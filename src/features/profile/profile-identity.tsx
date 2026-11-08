"use client";

import Link from "@/components/shared/preview-link";
import { ProfileContactActions } from "./profile-contact-actions";
import { ProfilePhotoEditor } from "./profile-photo-editor";
import { ProfileOwnerMenu } from "./profile-owner-menu";

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
  PROFILE_BIO_LIMIT,
  type ProfileInput,
  type ProfilePreviewData,
} from "./schema";

export function ProfileIdentity({
  profile,
  readOnly = false,
  onUpdate,
  editRequested = false,
  onEditRequestHandled,
  live = false,
  composeAction,
  contactActions,
  portraitEditor,
}: {
  profile: ProfilePreviewData;
  readOnly?: boolean;
  onUpdate?: (value: ProfileInput) => void | Promise<void>;
  editRequested?: boolean;
  onEditRequestHandled?: () => void;
  live?: boolean;
  composeAction?: ReactNode;
  contactActions?: ReactNode;
  portraitEditor?: ReactNode;
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
          live={live}
          portraitEditor={portraitEditor}
          onCancel={finishEditing}
          onSave={async (value) => {
            await onUpdate?.(value);
            setIdentity(value);
            setUpdated(true);
            finishEditing();
          }}
        />
      ) : (
        <>
          <ProfileHeading
            profile={profile}
            live={live}
            bio={identity.bio}
            actions={
              !readOnly ? (
                <div className="margin-profile-actions">
                  {live ? composeAction : <NewPostButton />}
                  <ProfileOwnerMenu
                    triggerRef={editButton}
                    username={profile.handle}
                    name={identity.name}
                    live={live}
                    onEdit={() => {
                      trigger.current = editButton.current;
                      setEditing(true);
                    }}
                  />
                </div>
              ) : (
                (contactActions ??
                (live ? null : (
                  <ProfileContactActions person={profile.person} />
                )))
              )
            }
          >
            <h1>{identity.name}</h1>
          </ProfileHeading>
        </>
      )}
      <p role="status" className="margin-status">
        {updated && !editing
          ? live
            ? "Profile saved."
            : "Profile updated in this preview only."
          : ""}
      </p>
    </header>
  );
}

function ProfileHeading({
  profile,
  children,
  editing = false,
  live = false,
  portraitEditor,
  bio,
  actions,
}: {
  profile: ProfilePreviewData;
  children: ReactNode;
  editing?: boolean;
  live?: boolean;
  portraitEditor?: ReactNode;
  bio?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="margin-profile-heading">
      <div className="margin-profile-portrait">
        <Avatar
          shape="rounded"
          person={profile.person}
          live={live}
          sizes="(min-width: 640px) 84px, 75px"
        />
        {editing && (live ? portraitEditor : <ProfilePhotoEditor />)}
      </div>
      <div className="margin-profile-name">
        {children}
        {editing && (
          <p className="margin-profile-username-hint">
            Your username is editable in{" "}
            <Link
              href={
                live
                  ? "/app/settings#profile-settings"
                  : "/?view=settings#profile-settings"
              }
            >
              Settings
            </Link>
            .
          </p>
        )}
      </div>
      {actions && <div className="margin-profile-intro-actions">{actions}</div>}
      {bio?.trim() && <p className="margin-profile-bio">{bio}</p>}
    </div>
  );
}

function EditProfileForm({
  profile,
  initial,
  onSave,
  onCancel,
  live,
  portraitEditor,
}: {
  profile: ProfilePreviewData;
  initial: ProfileInput;
  onSave: (value: ProfileInput) => void | Promise<void>;
  live: boolean;
  portraitEditor?: ReactNode;
  onCancel: () => void;
}) {
  const [saveError, setSaveError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: initial,
  });
  const bio = useWatch({ control, name: "bio" });
  const nearLimit = bio.length >= PROFILE_BIO_LIMIT - 50;
  useEffect(() => {
    setFocus("name");
  }, [setFocus]);
  return (
    <form
      noValidate
      aria-label="Edit profile"
      className="margin-profile-edit-form"
      onSubmit={handleSubmit(async (value) => {
        setSaveError("");
        try {
          await onSave(value);
        } catch (error) {
          setSaveError(
            error instanceof Error
              ? error.message
              : "Your profile could not be saved. Your changes are still here.",
          );
        }
      })}
      onKeyDown={(event) => {
        if (
          isSubmitting ||
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
      <ProfileHeading
        profile={profile}
        editing
        live={live}
        portraitEditor={portraitEditor}
      >
        <Field>
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            {...register("name")}
            maxLength={80}
            disabled={isSubmitting}
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
          maxLength={PROFILE_BIO_LIMIT}
          rows={4}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.bio)}
          aria-describedby={
            ["profile-bio-count", errors.bio && "profile-bio-error"]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        <p
          id="profile-bio-count"
          className="margin-field-hint"
          role={nearLimit ? "status" : undefined}
        >
          {bio.length} of {PROFILE_BIO_LIMIT} characters
        </p>
        {errors.bio && (
          <FieldError id="profile-bio-error">{errors.bio.message}</FieldError>
        )}
      </Field>
      {saveError && <FieldError>{saveError}</FieldError>}
      <div className="margin-profile-edit-actions">
        <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <p className="margin-field-hint">
        {live
          ? "Your name and bio are saved to your Margin account."
          : "Changes stay in this tab and reset when you refresh."}
      </p>
    </form>
  );
}
