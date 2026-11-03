"use client";
import { useRouter } from "next/navigation";
import { FriendControls } from "@/features/friends/friend-actions";
import type { FriendAction } from "@/features/friends/model";
import type { Person } from "@/features/feed/schema";
import { useSpaceClient } from "@/features/spaces/client";
import { requestMember, memberJson, memberChanged } from "./member-client";
import type { MemberContact } from "./member-contracts";
export function MemberFriendActions({
  person,
  relationship,
  compact = false,
}: {
  person: Person;
  relationship: MemberContact["relationship"];
  compact?: boolean;
}) {
  const client = useSpaceClient();
  const router = useRouter();
  return (
    <FriendControls
      live
      person={person}
      relationship={relationship}
      compact={compact}
      changeFriend={async (targetId: string, action: FriendAction) => {
        await requestMember(
          client,
          "/api/relationships",
          memberJson("POST", {
            targetId,
            action:
              action === "send"
                ? "request"
                : ["cancel", "decline"].includes(action)
                  ? "remove"
                  : action,
          }),
        );
        memberChanged();
        router.refresh();
      }}
    />
  );
}
