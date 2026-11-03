BEGIN;

-- Keep the database allowlist aligned with the existing notification service.
-- No stored notifications, invitation permissions or read state are changed.
ALTER TABLE "MemberNotification"
  DROP CONSTRAINT "MemberNotification_kind_check",
  ADD CONSTRAINT "MemberNotification_kind_check"
    CHECK ("kind" IN (
      'friend_request', 'friend_accepted', 'comment', 'reply', 'like',
      'message', 'space_invitation'
    ));

COMMIT;
