# Top 4

Top 4 is a private, ordered profile detail, with zero to four active accepted
friends. It is visible only to the owner and their accepted friends, and excludes
blocks in either direction (including a selected person's block with the viewer).
It sends no notifications and exposes no selection counts or membership through
contacts, discovery, public metadata, or unrelated exports.

The owner's enabled but empty section offers “Choose your Top 4”; visitors receive
no empty box. Hiding it in Settings removes the entire card for everyone while
preserving eligible selections. Cards retain their own natural heights; omitted
sections reserve no space in the profile rail.

## Data and API

Migration `20261109000000_profile_top_friends` adds `Account.showTopFriends`
(default true), `ProfileTopFriend`, and `ProfileTopFriendMutation`. It changes no
existing friendships, permissions, posts, or media. Foreign keys cascade on user
deletion; uniqueness and a position check enforce the four-slot bound in PostgreSQL.
The self-selection check also exists in PostgreSQL. Eligibility requires a real
accepted friendship, an active account, and no block, validated inside the save
transaction and again on every authorized read.

- `GET /api/profiles/me/top-friends?q=&before=` searches only the authenticated
  owner's eligible friends, with 30 results per page, and returns their current
  eligible selection for editing. It accepts no owner parameter.
- `PUT /api/profiles/me/top-friends` accepts only `{friendIds, requestId}`;
  `friendIds` is the complete ordered array (0–4); `requestId` is a UUID.
- Both use the existing verified member boundary and private no-store headers.
  Writes require the existing origin check and named `mutation` rate limit.
- Replacement, eligibility validation, and retry receipt insertion occur in one
  existing Serializable transaction under sorted user locks. Replacement also
  updates the owner's internal modification timestamp so an older waiting
  transaction retries with a fresh snapshot. Swaps cannot cause temporary
  position collisions. A duplicate UUID returns current eligible data
  without rewriting state. Reusing a UUID for a different payload returns 409.
- The account export includes `profile.showTopFriends` and eligible `topFriends`
  in display order, including when display is disabled. Mutation receipts are
  internal, not exported; they retain only an owner, UUID, payload hash and time,
  and cascade on account identity deletion.

Unfriend and block prune both directions and compact remaining positions in the
existing relationship transaction. Member and founder deactivation also prune
owned/inbound selections in their existing transactions. Read filtering protects
against stale rows if eligibility changes outside these application operations;
there is no asynchronous cleanup window in profile visibility. Hard user deletion
cascades selections; display order remains determined by the surviving positions.

## Editor and verification

The shared modal uses Inter names/controls, existing portraits/profile links,
accessible left/right moves, Save and Cancel, focus restoration, and announced
reordering. It does not require drag-and-drop. Unsaved changes stay local; failed
saves retain the draft and uncertain retries reuse the UUID. The grid keeps four
columns and 44px targets at 320px; empty/hidden sections have no placeholder.

`tests/top-friends-db.integration.test.ts` uses real disposable PostgreSQL for
constraints, authorization, eligibility, ordering, races, lifecycle pruning,
replay protection, visibility, export and notification absence.
`tests/top-friends.test.tsx` covers rendering and editing; the member HTTP suite
covers identity/origin/rate-limit guards. `tests/e2e/top-friends.spec.ts` checks the
same profile component in the existing isolated member rendering fixture on
desktop and mobile. Those rendering checks do not prove a live Clerk session.

Deploy the migration with the normal migration role before serving the new
application code. Back up any configured local account database before applying
it for local review. Existing records need no backfill. If rollback is needed
before use, the added tables/column can be removed after rolling back source;
after members save selections, prefer a forward fix or restore a reviewed backup
to avoid discarding selections. No real account database is modified by tests.

## Delivery evidence — 4 November 2026

Changed owners: `prisma/schema.prisma` and the migration above; this domain helper
and the existing member/social/moderation services; the member request boundary
and `/api/profiles/me/top-friends/route.ts`; member schemas/contracts, preferences,
profile composition and export; `features/profile/top-friends.tsx`, its editor and
stylesheet, and the shared profile content-gap variable. Existing uncommitted
product changes were preserved.

The complete `npm run verify` passed in 419.93 seconds: 193 PostgreSQL tests, 642
unit/component tests, 312 development browser checks and 36 production browser
checks. The 17 development and 24 production skips are the existing platform,
paused Event Space and development-only fixture exclusions. No failed or flaky
browser results remained. The run retains existing moderate dependency advisories
(12 overall; 5 production), font-source lint warnings and local-photo build tracing
warnings; no unrelated application changes were made to suppress them.

The local account database was backed up before applying only this additive
migration. Existing user/account/post/photo/gallery/friendship counts and credential
files were unchanged. One current-source server was restarted on port 3000, and
the actual signed-in profile/editor was opened and cancelled without saving any
selection. The backup is private, ignored local state under `.local/tools/backups/`.

After that full run, the owner requested two presentation refinements: use On
Repeat's 16px inner content gap and add its shared chevron to Edit. Formatting,
stylesheet ownership and whitespace checks passed after those refinements; the
owner is doing their visual/local checks. No additional browser run was started
for those two changes. Nothing was committed or pushed.
