"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Pencil } from "lucide-react";
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
          <Button variant="ghost" aria-label="Edit post">
            <Pencil aria-hidden="true" strokeWidth={1.5} />
            Edit
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
