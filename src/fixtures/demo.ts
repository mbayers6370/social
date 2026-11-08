import { getSampleSocial } from "./social";
import { getSampleSpaces } from "./spaces";
import { getSampleNadiaContent } from "./nadia";
import { demoProfileTracks, inesDemoTrack } from "./demo-music";

/** A coherent sample day never expires as the deployed portfolio gets older. */
export const DEMO_TIME = "2026-10-28T20:00:00Z";
export function demoBootstrap() {
  const social = getSampleSocial(DEMO_TIME);
  const beach = social.posts?.find((post) => post.id === "post-profile-beach")
    ?.media?.[0]?.image.src;
  social.posts = social.posts?.map((post) =>
    post.id === "post-fog"
      ? {
          ...post,
          media: post.media?.filter((photo) => photo.image.src !== beach),
        }
      : post,
  );
  social.postingRecords = social.postingRecords?.map((record) =>
    record.id === "post-fog"
      ? {
          ...record,
          imageCount:
            social.posts?.find((post) => post.id === record.id)?.media
              ?.length ?? 0,
        }
      : record,
  );
  social.profiles = social.profiles.map((profile, index) => ({
    ...profile,
    onRepeat: [
      profile.person.id === "ines"
        ? inesDemoTrack
        : demoProfileTracks[index % demoProfileTracks.length],
    ],
  }));
  const spaces = getSampleSpaces(DEMO_TIME);
  // The same bundled library is available to personal and Space composers.
  spaces.photos = social.photos.map((photo) => ({
    id: photo.id,
    ownerId: photo.ownerId,
    description: photo.description,
    width: photo.image.width,
    height: photo.image.height,
    src: photo.image.src,
  }));
  const nadia = getSampleNadiaContent(DEMO_TIME);
  nadia.profile.onRepeat = [demoProfileTracks[0]];
  return { social, spaces, nadia };
}
export type DemoBootstrap = ReturnType<typeof demoBootstrap>;
