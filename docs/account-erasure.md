# Account erasure and restoration

## Scope and trust boundaries

`AccountErasureService` owns the durable deletion intent. Settings offers separate
deactivation and permanent deletion. The latter requires a current provider
session, same-origin bounded JSON with the exact DELETE confirmation, a shared
rate limit and Clerk's strict credential reverification. The target is derived
only from the verified session. Deactivated and incomplete accounts can request
erasure; an unverified primary email does not by itself prevent a verified owner
from deleting an identity. The last active founder must appoint another founder
before using this self-service path.

Acceptance commits the intent and DEACTIVATED status together, revokes owned
invitation links and removes Top 4 placements. It returns 202, not a completed
deletion claim. Access is denied immediately. Sign-out drops in-tab account data.
The `accounts` maintenance job retries independently of other retention jobs,
with the shared lease and time budget. Provider-only identities are also queued.

The worker removes profile data, posts/comments, messages/Notebook, notifications,
relationships/blocks, preferences, music/Top 4, owned invitation links/labels,
claims for the identity, and application reports by/about the account and related
review decisions. Other members' independent text is not searched for mentions
of a person. Shared Spaces transfer to another active administrator, then the
oldest active member; if none remains, the Space is removed through its existing
lifecycle cleanup. Canonical owned photos lose their placements and become
DELETE_PENDING; User is retained until all photo objects have been purged, so
deletion retries cannot lose object keys through a cascade. Interrupted uploads
also retain the existing late-write cleanup and bounded orphan-inventory defense.

Clerk deletion runs outside database transactions; success and 404 are complete,
while timeout/403/429/5xx remain retryable. Uncertain invitation sends retain their
private reconciliation record until the provider can confirm their state. One
account failure rotates behind other work rather than stopping the batch. Pending
accounts and provider failures make aggregate maintenance health non-healthy;
no email, subject, body, object key or raw provider error enters job logs.
Onboarding and erasure share an identity lock; a provider-only identity cannot
finish account setup while its deletion is pending.

`/api/webhooks/clerk` verifies the bounded request with the installed Clerk/Svix
verifier. Configure `CLERK_WEBHOOK_SIGNING_SECRET` and subscribe to `user.deleted`.
Duplicates are idempotent; a failed queue commit returns non-2xx for retry. This
also handles provider/dashboard deletion, which cannot be vetoed by the app's
last-founder check. Establish successor/recovery procedures before deleting the
operator identity through Clerk. No unsigned event or browser actor field is trusted.

## Receipts, backups and assisted requests

The owner approved a maximum 30-day backup lifetime and 90-day completed deletion
receipts for public beta. Production backup expiration is an operational setting,
not something Prisma can enforce. Verify DB/WAL/replica/export and object-storage
recovery settings against this maximum before launch. Completed receipts contain
the internal account reference and deletion/retry timestamps; the Clerk reference
is cleared on completion. Pending receipts retain only the identity needed for
provider retries. Completed receipts are purged after 90 days; no content is kept
in the receipt. A specific preservation obligation needs separate authorized, purpose-limited handling and a review deadline; this flow does not invent a hold
or retain a blanket copy of reports. Support/provider logs have their own reviewed
schedules, still to be finalized.

**A DB snapshot alone is not a deletion journal.** Before acknowledging an accepted
request, the service writes its receipt to the private R2 `erasure/` prefix. The
worker also requires a successful journal write before destructive cleanup. It
writes a content-free completed receipt and clears the Clerk reference when done.
The journal prefix must be excluded from photo/database rollback and public access.
The photo orphan scan covers only `social/`, never `erasure/`. Keep independent
restricted exports as an additional recovery copy before backup/restore operations.
Keep versioned encrypted copies under restricted operator access, outside the
snapshots being restored. Verify that the latest journal is recoverable without
the application DB. An export is a private file, never a public attachment or
committed report. Apply the same backup maximum to old journal copies and do not
retain expired completed receipts through an archive indefinitely.

The reviewed operator environment requires `MARGIN_ERASURE_OPERATOR=1` and Node 22:

```sh
npm run account:erasure -- request --subject <ownership-verified-clerk-subject>
npm run account:erasure -- export-receipts --output /secure/new-private-journal.json
npm run account:erasure -- restore-journal
npm run account:erasure -- import-receipts --input /secure/latest-private-journal.json
```

The request command is for assisted requests after the operator verifies account
ownership securely. No public erasure-by-email or arbitrary user-ID endpoint exists.
It supports people unable to use the app or outside the product's connection
region. Do not request passwords, verification codes, or unarranged identity-document
uploads. The owner confirmed `support@margin.social` is live for these requests. Ownership verification, response handling and escalation workflows still need operational review before public beta.

During restore, keep product traffic offline, restore the DB, run `restore-journal` against the unchanged R2 receipt prefix (or import the latest
independent journal export), and run maintenance until all affected accounts/objects and
provider identities are erased and all jobs are healthy. Import deactivates restored
accounts and reopens their deletion intents. Even a completed receipt is reopened
if its User reappears. Do not reopen service from an older backup without a current
journal, or from a backup outside the approved maximum. Verify this procedure in
hosting with disposable data. Restoring or deleting the R2 journal along with an older DB defeats this safeguard;
that operation is prohibited by the restore procedure. Confirm the prefix is
recoverable and protected in hosting before launch.

## Deployment and verification

Apply the reviewed `20261110000000_account_erasure` migration with the migration
owner before deploying the new UI/worker. Grant the restricted runtime role the
same SELECT/INSERT/UPDATE/DELETE permissions on AccountErasure as other runtime
tables. No live or local-account migration is automatically applied by this work.
Deploy the existing maintenance worker with Clerk delete-user capability and
private storage read/delete/list access. Connect health alerts; verify that retries
and deletion complete with real disposable provider identities and private objects.
Verify actual reverification, signed webhook delivery/retries and the independent
journal/restore procedure before public beta. Local tests use real disposable
PostgreSQL and controlled provider/storage doubles; they do not certify hosting.

Related: [maintenance](../src/server/jobs/README.md),
[public policy review](public-content-review.md),
[Clerk reverification](https://clerk.com/docs/guides/secure/reverification),
[Clerk user deletion](https://clerk.com/docs/reference/backend/user/delete-user).
