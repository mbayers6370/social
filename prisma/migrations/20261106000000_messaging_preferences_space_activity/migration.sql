BEGIN;

-- Existing members retain messaging unless they explicitly turn it off.
ALTER TABLE "Account" ADD COLUMN "messagingEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MemberNotification"
  DROP CONSTRAINT "MemberNotification_kind_check",
  ADD CONSTRAINT "MemberNotification_kind_check"
    CHECK ("kind" IN (
      'friend_request', 'friend_accepted', 'comment', 'reply', 'like',
      'message', 'space_invitation', 'space_post'
    ));

COMMIT;
