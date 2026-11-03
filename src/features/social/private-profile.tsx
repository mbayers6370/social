"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Add, Edit, Notebook } from "@/components/margin-icons";
import { LiveAppShell } from "@/components/layout/live-app-shell";
import { Button } from "@/components/ui/button";
import { SectionMotif, SectionTitle } from "@/components/shared/section-motif";
import { ProfileFrame } from "@/features/profile/profile-frame";
import { ProfileIdentity } from "@/features/profile/profile-identity";
import { ProfileGalleryPreview } from "@/features/profile/profile-gallery-preview";
import { OnRepeat } from "@/features/profile/on-repeat";
import type { ProfileTrack } from "@/features/profile/schema";
import {
  SpacePostCard,
  type ConversationTarget,
} from "@/features/spaces/space-post-card";
import { useSpaceClient } from "@/features/spaces/client";
import { memberPerson } from "@/lib/member-person";
import { useMember } from "./member-provider";
import { PersonalComposer } from "./personal-composer";
import { MemberPhotoPicker } from "./member-photo-picker";
import { MemberProfileContact } from "./member-profile-contact";
import { memberChanged, memberJson, requestMember } from "./member-client";
import type { PrivateProfileData } from "./contracts";

/** The approved profile presentation, backed exclusively by member read models
 * and authenticated mutations. Preview providers are never an authority here. */
export function PrivateProfile({
  data,
  editRequested = false,
  conversationTarget,
}: {
  data: PrivateProfileData;
  editRequested?: boolean;
  conversationTarget?: ConversationTarget;
}) {
  const client = useSpaceClient();
  const member = useMember();
  const router = useRouter();
  const own = data.profile.relationship === "self";
  const visible = own || data.profile.relationship === "friends";
  const person = memberPerson(data.profile.id, {
    displayName: data.profile.name,
    portraitPhotoId: data.profile.portraitPhotoId,
  });
  const [editing, setEditing] = useState(editRequested);
  const [photoPicker, setPhotoPicker] = useState(false);
  const [tracks, setTracks] = useState<ProfileTrack[]>(
    data.profile.onRepeat ?? [],
  );
  const composer = useRef<{ open: (trigger?: HTMLElement) => void }>(null);
  const galleryHref = own
    ? "/app/gallery"
    : `/app/gallery?person=${encodeURIComponent(person.id)}`;
  const photos = [...data.gallery]
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .map((photo) => ({
      description: photo.description,
      caption: "",
      aspect:
        photo.width >= photo.height
          ? ("landscape" as const)
          : ("portrait" as const),
      image: {
        src: client.photoSrc(photo.id),
        width: photo.width,
        height: photo.height,
      },
    }));
  return (
    <LiveAppShell
      active="profile"
      viewer={data.viewer ?? (own ? data.profile : undefined)}
    >
      <ProfileFrame personId={person.id}>
        <ProfileIdentity
          live
          profile={{
            person,
            handle: data.profile.username ?? "",
            bio: data.profile.bio ?? "",
            onRepeat: tracks,
            photos,
            recent: [],
          }}
          readOnly={!own}
          editRequested={
            own && (editing || Boolean(member?.profileEditRequested))
          }
          onEditRequestHandled={() => {
            setEditing(false);
            member?.finishProfileEditRequest();
          }}
          onUpdate={async (value) => {
            await requestMember(
              client,
              "/api/profiles/me",
              memberJson("PATCH", value),
            );
            memberChanged();
            router.refresh();
          }}
          composeAction={
            <Button
              className="margin-new-post-button"
              variant="outline"
              onClick={(event) => composer.current?.open(event.currentTarget)}
            >
              <Add aria-hidden="true" />
              New Post
            </Button>
          }
          portraitEditor={
            <Button
              className="margin-profile-photo-edit"
              variant="ghost"
              size="icon"
              aria-label="Change profile photograph"
              onClick={() => setPhotoPicker(true)}
            >
              <Edit aria-hidden="true" />
            </Button>
          }
          contactActions={
            <MemberProfileContact
              contact={{
                person,
                username: data.profile.username ?? "",
                relationship: data.profile.relationship,
              }}
              viewerId={data.viewerId}
              messagingEnabled={
                data.profile.messagingEnabled &&
                member?.identity.preferences.messagingEnabled === true
              }
            />
          }
        />
        <div className="margin-profile-details">
          <OnRepeat
            live
            own={own}
            restricted={!visible}
            tracks={visible ? tracks : []}
            onSaved={(saved) => {
              setTracks(saved);
              router.refresh();
            }}
          />
          <ProfileGalleryPreview
            live
            photos={photos}
            href={galleryHref}
            visible={visible}
            own={own}
          />
        </div>
        <section
          className="margin-profile-posts"
          aria-labelledby="recent-posts-title"
        >
          {own && (
            <PersonalComposer
              viewer={person}
              ref={composer}
              entryVisible={false}
            />
          )}
          <div className="margin-profile-posts-card margin-profile-section-card">
            <header className="margin-section-heading">
              <SectionTitle
                id="recent-posts-title"
                tabIndex={-1}
                motif={<SectionMotif icon={Notebook} />}
              >
                Recent Posts
              </SectionTitle>
            </header>
            <div className="margin-feed-layout" data-profile="true">
              <div className="margin-feed-column">
                <div className="margin-feed-list" aria-label="Profile posts">
                  {visible &&
                    data.posts.map((post) => (
                      <div key={post.id}>
                        <SpacePostCard
                          profileDate
                          post={{ ...post, author: person, space: null }}
                          viewerId={data.viewerId}
                          conversationTarget={conversationTarget}
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
            {(!visible || !data.posts.length) && (
              <p className="margin-empty-copy">
                {visible
                  ? "No posts here yet."
                  : "Posts are shared with friends."}
              </p>
            )}
            {data.nextCursor && (
              <Link
                className="margin-section-link"
                href={`/app?person=${encodeURIComponent(person.id)}&before=${encodeURIComponent(data.nextCursor)}`}
              >
                Older posts
              </Link>
            )}
          </div>
          <p className="margin-profile-note margin-note">
            Posts are designed to disappear after 30 days. Photographs kept in
            Gallery remain until you remove them.
          </p>
        </section>
      </ProfileFrame>
      {own && (
        <MemberPhotoPicker
          portrait
          open={photoPicker}
          onOpenChange={setPhotoPicker}
          photos={data.gallery}
          onChoose={async (photo) => {
            await requestMember(
              client,
              "/api/profiles/me/portrait",
              memberJson("PUT", { photoId: photo.id }),
            );
            memberChanged();
            router.refresh();
          }}
        />
      )}
    </LiveAppShell>
  );
}
