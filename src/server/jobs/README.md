# Retention and scheduled maintenance

This worker is part of the **preserved full-stack implementation**, not the public demo. Demo expiry labels use a fixed fictional date; Exit demo and refresh reset the in-memory session. A static deployment needs no maintenance process, database, Clerk account or R2 bucket. The [main README](../../../README.md) describes the demo and the retained engineering capabilities.

The dedicated Node 22 worker runs immediately on startup and every 60 seconds. It is separate from Next.js request processes, so an idle website still gets cleanup. No public job URL or browser-controlled job payload exists. It reuses PostgreSQL, Clerk and the existing private photo store; no additional vendor is required.

## Policy and canonical data

- Member messages expire exactly 30 days after creation; self-addressed Notebook entries expire after 90 days. Conversation history, thread previews/unread state, notifications, exports and report access enforce expiry before the worker runs. New entries never extend older entries.
- Personal publication markers survive deletion, retain the original posting zone for edits, and are erased in bounded batches after 35 days. Daily allowances use the account’s saved IANA zone and carry recent usage forward for at least 24 hours after a zone change.
- Posts retain their original 30-day deadline, capped by an Event Space's deadline. Manual deletion immediately deletes the post row. Scheduled expiry also hard-deletes legacy tombstones, comments, likes, post notifications and attachment rows through foreign-key cascades. Expired Spaces use the existing lifecycle service and preserve only its minimal event-ID tombstone against reopening an erased event.
- A photo has **one canonical `Photo` row and one normalized stored original**. Gallery, portraits, posts and multiple Spaces reference its ID; reference/join rows do not copy the photo. Reuse does not upload another object. Removing one placement never deletes another valid placement. No cross-member file-hash deduplication is introduced.
- Photos with no valid post, Gallery or portrait reference are retired, their private object is deleted, and description, dimensions, byte count and original object key are cleared. A successful upload's minimal quota marker survives for 48 hours so deletion and saved-zone changes cannot bypass the three-upload daily limit; a subsequent bounded sweep removes that marker. Failed-upload markers can be removed immediately after object deletion.
- Failed object deletion retains its key in `DELETE_PENDING`. Attempt timestamps rotate failed keys behind unattempted work; one bad object does not stop the rest of the batch. A late upload that finishes after its reservation was erased recreates a deletion intent, never a readable asset. A bounded object-store inventory also removes objects older than ten minutes with no database record, covering a dead uploader that cannot recreate that intent. The private scan cursor resumes interrupted pages and wraps after the final key; referenced objects and recent writes are preserved. Current references and state are rechecked before deleting bytes.

Database `DELETE` removes live application rows; it does not promise forensic erasure of PostgreSQL pages, WAL, replicas or backups. Cloud object deletion, backup rotation/restoration, independent safety reports, provider account erasure, screenshots and recipient exports remain separate operational/policy boundaries. Do not delete a `User` row until its object cleanup finishes: its cascade would discard pending object keys.

## Scheduling, concurrency and failure

`maintenance.ts` owns six independent jobs: invitations, messages, posts, Spaces, photos and accounts. The accounts job runs the durable [account-erasure lifecycle](../../../docs/account-erasure.md), including the independent private R2 journal, Clerk identity deletion, storage completion and 90-day receipt expiry. Each claims an atomic database lease for three minutes. Another host or overlapping tick skips a claimed job. Crashed-worker leases expire automatically. Each job has a 45-second work budget, bounded batches and bounded database/provider calls; it finishes or fails the current unit before releasing its lease. There is no detached timeout race that leaves deletion running after a reported success.

| Failure                         | Recovery                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk outage                    | Local invitation denial persists; retry reconciliation next tick. Message/post cleanup still runs.                                                    |
| Object-store outage             | Reads remain denied, keys remain retryable, other objects continue. Database-only cleanup still runs.                                                 |
| Database outage or worker crash | Nonzero/sanitized failure and stale health; expired visibility still enforced by normal reads. Restart and expired leases recover work.               |
| Backlog                         | Full batches mark possible backlog and make health nonzero until a later sweep catches up. Check counts and increase reviewed capacity before launch. |
| Missing scheduler               | Health becomes stale after three minutes, including when a job has never succeeded.                                                                   |

Health results and logs contain only aggregate counts, job names, timestamps and failure counts. A private object-scan cursor is stored separately and omitted from health output. No body text, email, user ID, object key, token or raw provider error is logged. The worker starts all five jobs independently each minute. Slow/failed jobs can exceed normal cadence; health must be monitored rather than treating a timer as proof of completion.

## Commands and launch activation

```sh
npm run maintenance:run     # one bounded cycle; nonzero if any job fails
npm run maintenance:work    # startup cycle, then every minute; drains on SIGTERM/SIGINT
npm run maintenance:status  # aggregate JSON; nonzero for stale, failed or possibly backlogged jobs
```

These commands require `MARGIN_MAINTENANCE_ENABLED=1`. They permanently erase expired data. Review the target environment before enabling them. They use `DATABASE_URL` with the runtime role, not the migration role. The worker needs matching Clerk invitation read/revoke and user-delete credentials and the same private photo-store configuration as the app, with bucket-scoped list/read/delete capability for canonical objects under `social/`. Its inventory uses [R2’s supported S3 ListObjectsV2 prefix/start-after pagination](https://developers.cloudflare.com/r2/api/s3/api/). A complete orphan scan can take multiple ticks; monitor scan counts and verify full-sweep latency at the intended scale. `invitations:sync` remains a manual read/revoke-only reconciliation command and shares its adapter with the worker; neither worker nor reconciliation sends invitations.

Before launch:

1. Review/apply `20261107000000_scheduled_retention` against the intended database, using its migration owner. It adds job health/leases, an expiry scan index, private inventory progress and photo deletion-attempt timestamps; it does not erase existing content. Grant the runtime role SELECT/INSERT/UPDATE/DELETE on `MaintenanceJob`, consistent with the existing runtime table grants. No live migration runs automatically.
2. Install the reviewed application with Node 22. On a Linux/systemd host, adapt `ops/systemd/margin-maintenance.service` for the actual runtime user, Node/npm path and release directory. Put the explicit enable flag and that environment's runtime credentials in `/etc/margin/maintenance.env`, readable only by the service administrator. Enable/start this service as a separate deployment action; a Next.js web deployment alone does not start it. On another host, supervise the same long-running `maintenance:work` command.
3. Connect the host monitor to `maintenance:status` at least once a minute and alert on nonzero exit, missing worker, failure counts or persistent full batches. Logs are available through the service supervisor. No notification destination is assumed or contacted by this code.
4. Verify consecutive minute ticks, worker restart/takeover, a disposable expired message/note/post and last-reference photo, real Clerk revocation, storage deletion, and recovery from provider failure in the intended hosted environment. Confirm object privacy, backup rotation and deletion reapplication after restore.

The service unit and runtime are implemented; installing/enabling a hosted worker, applying the live migration and connecting production alerts remain deployment actions. Local tests never activate this worker against `.env` or the application database.

Account erasure also requires the reviewed `20261110000000_account_erasure` migration and runtime grants on `AccountErasure`. Configure signed `user.deleted` webhook delivery and private R2 `erasure/` read/write/list/delete access. Keep that journal prefix separate from photo/database rollback and public access. The web service must be able to write the private receipt before acknowledging deletion; the worker clears its Clerk reference on completion and removes completed receipts after 90 days. Deploy and verify the 30-day maximum backup policy and restore journal before public beta.
