"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Edit } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { usePreview } from "@/features/local-preview/provider";
import type { FriendPost } from "@/features/local-preview/model";

const PostComposer = dynamic(
  () =>
    import("@/features/compose/post-composer").then(
      (module) => module.PostComposer,
    ),
  { ssr: false },
);

export function PostManagement({ post }: { post: FriendPost }) {
  const preview = usePreview();
  const [editing, setEditing] = useState(false);
  if (post.author.id !== preview.bootstrap.viewerId) return null;

  return (
    <div className="margin-post-management">
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="margin-post-edit-trigger"
            aria-label="Edit post"
          >
            <Edit aria-hidden="true" />
            <span className="sr-only lg:not-sr-only">Edit</span>
          </Button>
        </DialogTrigger>
        {editing && (
          <PostComposer
            editingPost={post}
            onComplete={() => setEditing(false)}
          />
        )}
      </Dialog>
    </div>
  );
}
