"use client";
import { usePreview } from "@/features/local-preview/provider";
import { InviteFriends } from "@/features/account/invite-friends";
import { BrandBrackets } from "@/components/shared/brand-brackets";
export function EmptyFeed() {
  const preview = usePreview();
  const hasFriends = preview.state.friendships.some(
    (pair) =>
      pair.status === "accepted" &&
      pair.people.includes(preview.bootstrap.viewerId),
  );
  return (
    <section className="margin-empty-feed" aria-labelledby="empty-feed-title">
      <BrandBrackets>
        <span className="margin-empty-feed-mark">A little room</span>
      </BrandBrackets>
      <h2 id="empty-feed-title">
        {hasFriends
          ? "A quiet day in your circle."
          : "It starts with your people."}
      </h2>
      <p>
        {hasFriends
          ? "Nothing new to catch up on. When your friends share a little of their day, you’ll find it here."
          : "Bring someone you’d take the long way for. A good conversation doesn’t need a crowd."}
      </p>
      {!hasFriends && <InviteFriends />}
      <p className="margin-field-hint">
        {hasFriends
          ? "Your own updates live on your profile."
          : "Margin is beginning with a small, invited community."}
      </p>
    </section>
  );
}
