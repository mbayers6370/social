<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local storage is not a source workspace

`.local/` contains protected local state and bounded generated artifacts. Never
clone, copy, rsync, archive, or create a Git worktree of this repository (or any
other source tree) anywhere under `.local/`.

- Put disposable source snapshots in the operating system temporary directory
  and remove them in `finally`/exit cleanup, including after failed checks.
- The only generated application build allowed under `.local/` is the single
  replace-in-place review build at `.local/local-review/next/`.
- Verification may retain only bounded reports under `.local/verification/`;
  it must never retain a source checkout there.
- Do not delete or overwrite protected state: `.local/database.json`,
  `.local/postgres/`, `.local/private-photos/`, `.local/auth-activation/`,
  `.local/socket/`, or `.local/tools/`.
- Run `npm run local:check` before and after workflows that create substantial
  artifacts. If it fails, inspect and clean generated data; do not broaden the
  allowlist to conceal a copied source tree.
- `npm run clean:local -- --apply` is the supported generated-artifact cleanup.
  It must remain idempotent and preserve the protected paths above.

The `.local` hard limit is an intentional guardrail. If legitimate protected
data ever approaches it, review that data explicitly before changing the limit.

## Verify the site the user actually uses

- For signed-in UI work, verify the actual `/app` account route on the running
  local server. Fictional previews and mocked member fixtures are supplemental
  tests, not evidence that the user's signed-in site was updated.
- `npm run dev` hot-reloads source. `npm start` and `npm run review` serve compiled
  production snapshots; a CSS variable or font change requires a rebuild there.
- For this Mac's real Clerk account, use `npm run review -- --localhost` for
  production-optimized review. Do not replace it with `npm start`: the standard
  hosted-production configuration rejects the local Clerk test credentials and
  makes sign-in unavailable. Keep hosted authentication safeguards intact.
- After changing UI source, rebuild/restart the current production review and
  reload the actual account page before calling the visible change complete.
  Preserve authentication and local account data. Never apply pending migrations
  with unrelated data/permission effects merely to display a styling change.
- Keep one server on the user's port. Use the guarded npm commands, never bypass
  their stale-build or duplicate-server checks by invoking Next.js directly.
- Never overwrite build assets used by a running server. Stop the owning server
  before rebuilding its output. Full verification remains required before a push.
