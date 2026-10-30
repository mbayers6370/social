# Private backend slice

Status: implemented for local verification, disabled by default. The preview UI continues to use fictional, in-memory data. This slice is not a public-launch sign-off.

## Boundary and account policy

`MARGIN_PRIVATE_BACKEND_ENABLED=1` enables the candidate HTTP handlers only after the operator has reviewed rollout gates. Clerk's server session supplies the provider subject. Headers, preview actors and submitted owner IDs never supply identity. `User.clerkId` maps that subject to an internal ID; a separate `Account` row must explicitly be `ACTIVE`. Missing, pending and deactivated accounts cannot read or write private resources. There is no signup or self-activation endpoint. Existing preview music identities remain unactivated and the original User/music columns are unchanged.

Activation is an operator responsibility: verify the real Clerk account, verified email, invitation/age policy and recovery/MFA settings before creating an ACTIVE Account row. This implementation does not create hosted accounts, change Clerk registration settings or verify hosted session revocation. `DELETE /api/account` deactivates Margin access; it is not full provider/account erasure.

## API contract

All responses are private/no-store and noindex. Missing configuration/provider failures deny access. Mutations require an exact configured Origin; cross-site Fetch Metadata is denied. No permissive CORS headers are emitted. All operations use the existing authenticated-subject Redis limit (currently ten requests/minute, including reads; tune separate read limits before UI integration).

| Method and path               | Input and behavior                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/account`            | Own internal ID and activation state, or null; never provider identifiers                                                        |
| DELETE `/api/account`         | Deactivate access, erase post text, revoke friendships and retire photos                                                         |
| POST `/api/relationships`     | Strict JSON `{ targetId, action }`; request, accept incoming request, remove, block or unblock                                   |
| POST `/api/posts`             | Strict JSON `{ body }`, 1–2,000 characters; create one friends-only text/link post                                               |
| POST `/api/posts/photo`       | JPEG/PNG/WebP bytes, maximum 8 MB; `X-Photo-Description` required, 1–500 characters; create one photo post and gallery reference |
| GET/DELETE `/api/posts/[id]`  | Current audience read; owner-only deletion erases text and removes post references                                               |
| GET/DELETE `/api/photos/[id]` | Current audience byte delivery; owner-only deletion removes all gallery/post references and deletes the object                   |

Clients must treat ambiguous create responses as unresolved; this first slice does not yet provide client idempotency keys or automatic retry. Successful independent create requests consume separate slots. Relationship transitions and deletion are retry-safe in their effects. Full post editing, attachment reuse, collection listing and gallery arrangement are outside this slice; do not connect the full preview UI until those contracts exist.

## Authorization and consistency

Only an active owner or an active, currently accepted friend can read a post or referenced photo. Pending requests grant nothing. A block in either direction overrides friendship; blocking removes the friendship, and unblocking does not restore it. Missing, unauthorized, deleted, expired and unreferenced resources return 404. A friend cannot edit/delete the owner's resources. Every resource request rechecks the database; no long-lived signed photo URL is issued. An already authorized in-flight response or previously saved copy cannot be recalled.

Serializable transactions lock affected user rows in a consistent order. Bounded retries cover Prisma serialization/deadlock errors, including SQLSTATE errors from raw locking queries. The existing Los Angeles day rules apply: three ordinary posts or one exclusive link post, three new photographs shared with Gallery, and twenty gallery entries. Upload reservations count toward caps and expire after ten minutes. A photo-only addition creates a feed post and uses both allowances. Deleting a post preserves its gallery photo and its photo allowance. Deleting the photo removes its references everywhere.

Foreign keys, canonical pair checks, no-self checks, bounded dimensions/body lengths and composite ownership foreign keys provide database protection. A post cannot reference another owner's photo even if DAL attachment code regresses. These constraints do not replace audience checks.

RLS is not enabled. The server DAL is the current audience enforcement boundary. With Prisma's pooled service role, RLS would require transaction-local verified identity, policies for both post and reference-derived photo audiences, separate maintenance privileges, and tests proving no connection-context leakage. That remains a useful additional defense against a missed query or SQL injection; the runtime role's lack of BYPASSRLS does not itself establish row isolation.

## Media and deletion lifecycle

Uploads are authenticated/rate limited and size bounded while reading the actual stream. The server checks signatures, rejects unsupported/animated formats, decodes with a 40-megapixel/10,000-pixel-side limit and timeout, rotates, and re-encodes WebP without EXIF/GPS/XMP. The original upload is not retained. Opaque server-generated keys and one normalized canonical asset serve both post and gallery references.

The R2 adapter sends no public ACL and produces no public/signed storage URL. Delivery checks current references and audience before reading bytes, serves a fixed image MIME/filename and forbids public caching. It never calls the public Next image optimizer. Bucket-level privacy, CDN behavior and provider credentials still require real staging verification.

Photo deletion commits denial and removes references first, then deletes the object. Success clears the description and marks PURGED. A provider failure leaves DELETE_PENDING for retry, with reads already denied. Trusted `purgeDeletedPhotos()` and `expirePosts()` calls process bounded batches and can be rerun. Expiry denies reads synchronously even when maintenance is delayed; the expiry job subsequently erases text and post references. A gallery reference can intentionally retain its photo after a post expires.

No scheduler or public job endpoint was added. Before launch, wire authenticated maintenance, alerts and reconciliation for interrupted uploads/late object writes; verify deletion/versioning/backups and restore behavior. Do not hard-delete User rows before object cleanup, because cascading deletion would discard object-key tombstones. Deactivation alone does not remove Clerk identities, backups, all identity metadata, or copies saved by recipients.

## Verification and rollout

`npm run test:social-db` creates a randomly named database on the existing loopback-only local cluster, deploys candidate migrations, grants a separate runtime role, runs actual PostgreSQL/decoder/private-filesystem tests, and drops the database. It never uses `.env` or migrates `margin_local`. The same tests are mandatory in full verification and the existing CI job, using an immutable PostgreSQL image. Clerk, Redis and R2 are mocked at the HTTP boundary; their hosted behavior is unverified. Default unit runs visibly skip the opt-in database cases; full verification runs them separately against the real database.

Before activating even a closed hosted pilot:

1. Review the additive migration on a staging clone; verify role grants, backup and rollback. Apply it with the migration owner, not the runtime credential. Existing users remain unactivated. Code rollback disables the feature; do not drop populated tables as an automatic rollback.
2. Provision approved test accounts and prove real Clerk login, cookie/origin behavior, revoked/banned sessions, recovery and activation policy. No credentials are included in source.
3. Prove the R2 bucket has no public access, authenticated byte delivery rejects other accounts and blocks, the optimizer cannot proxy it, and deleted objects/derivatives cannot be fetched through caches.
4. Prove Redis outage/limit behavior, configure appropriate read/upload resource limits, and exercise interrupted uploads, quota conflicts and ambiguous-create recovery.
5. Configure and observe retention/deletion/reconciliation workers; validate backup retention and restoration do not revive denied content. Complete full provider account erasure separately.
6. Connect only the implemented UI paths, add end-to-end real-provider coverage, finish moderation/export/operational requirements and independently review privacy-sensitive code before public launch.
