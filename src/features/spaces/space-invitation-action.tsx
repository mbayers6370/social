"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { memberChanged } from "@/features/social/member-client";
import type { SpaceListData } from "./contracts";
import { useSpaceClient } from "./client";
import { useSpaceAction } from "./use-space-action";

export function SpaceInvitationAction({
  invitation,
  onJoined,
}: {
  invitation: SpaceListData["invitations"][number];
  onJoined?: () => void;
}) {
  const router = useRouter();
  const client = useSpaceClient();
  const action = useSpaceAction();
  return (
    <div className="margin-space-invitation-action">
      <Button
        disabled={action.busy}
        onClick={async () => {
          const joined = await action.run(
            `/api/space-invitations/${encodeURIComponent(invitation.id)}/accept`,
            "POST",
            undefined,
            false,
            { refresh: false },
          );
          if (!joined || typeof joined.id !== "string") return;
          if (!client.preview) memberChanged();
          onJoined?.();
          router.push(
            client.href(`/app/spaces/${encodeURIComponent(joined.id)}`),
          );
        }}
      >
        {action.busy ? "Joining…" : `Join ${invitation.space.name}`}
      </Button>
      {action.error && <p role="alert">{action.error}</p>}
    </div>
  );
}
