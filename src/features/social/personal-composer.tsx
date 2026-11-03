"use client";
import type { Ref } from "react";
import {
  SpaceComposer,
  type SpaceComposerHandle,
} from "@/features/spaces/space-composer";
import { memberPerson } from "@/lib/member-person";
/** Personal and Space drafts share the approved compose surface and photo picker.
 * The personal endpoint enforces its own post quota and friends-only audience. */
export function PersonalComposer({
  viewer,
  entryVisible = true,
  ref,
}: {
  viewer: { id: string; name: string };
  entryVisible?: boolean;
  ref?: Ref<SpaceComposerHandle>;
}) {
  return (
    <SpaceComposer
      personal
      entryVisible={entryVisible}
      viewer={memberPerson(viewer.id, { displayName: viewer.name })}
      ref={ref}
    />
  );
}
