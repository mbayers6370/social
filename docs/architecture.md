# Architecture

## Module boundaries

- `src/app/` owns routing, metadata, server-rendered layouts, and API handlers.
- `src/features/` owns feature presentation, client-safe schemas, and local interaction state.
- `src/components/ui/` contains owned Radix/shadcn-style primitives. Shared layout and branding live in their corresponding component folders.
- `src/lib/` contains shared validation, media policy, and small utilities.
- `src/server/` contains server-only data access, integrations, authorization, security, and development fixtures.

Routes pass explicit data objects to feature components. Keep secrets and database operations out of client modules. Add client boundaries only where interaction requires them; lazy-load editors and dialogs when appropriate.

## Development and production

The root layout owns fonts, Clerk and session access. Only the `(development)` route-group layout installs fictional social/Spaces providers, and only in development. Production `/` renders the public website; development fixture routes and music APIs reject production requests. The separately gated `/app` layout installs an actual `MemberIdentity` behind the verified session monitor. No fictional provider is mounted above member pages.

`npm run review` creates a production-optimized build directly from the current
working tree and exposes it over one private-network HTTPS origin for desktop and
phone review. `npm run review -- --localhost` instead binds only to
`http://localhost:3000` for account review on the Mac. Its generated output is
isolated under `.local/local-review/next`,
so it cannot replace the standard `.next` build served by `npm start`; both are
compiled from this same working tree, with no second source checkout. Test Clerk
keys and filesystem media are accepted only when the explicit review flag,
private HTTPS origin (or exact HTTP localhost), loopback `margin_local` runtime database, non-CI process,
and local-media flag all agree. Hosted production continues to require live
provider keys and hosted private storage. Local review is UX evidence, not
hosted-provider or deployment evidence.

The local provider keeps posts, galleries, friendships, notifications, and preferences in memory across navigation. A separate development-only Spaces provider shares canonical Space data across its pages and the main Feed without extending the personal provider. Feed selects opted-in, current-member, unexpired and unblocked Space references by other members, merges them chronologically with personal items, and uses the same Space post/conversation renderer as the live Feed. The adapter is scoped to fictional components; live HTTP clients keep the authenticated boundary. Messages keeps separate screen-local messages and drafts. Refresh resets social preview state; optional local music persistence is the exception. Nadia’s pending-request fixture exposes only her portrait and bio initially. Accepting the request loads her sample profile through a development-only Server Function, then commits the profile content and accepted relationship together. Loading failures leave the request pending; this function never creates a real account or friendship and rejects production requests.

The preview identity is fictional and is not authenticated production access. All real writes must derive identity on the server and check authorization again at the resource boundary.

## Shared post rendering

`PostCard` is the reusable post article. It accepts server-rendered author/content children and local action slots. `PostFooter` provides expiry details and the trailing Conversation action; profile owners also receive Edit. Feed and profile posts share the same action placement.

The main feed excludes the viewer's own personal posts; opted-in Space posts retain their shared chronology. Profile posts share one Recent posts card with full-width separators. Photos precede text and open through shared image viewers. Preview profile conversations flip in place on desktop; preview feed conversations use an adjacent desktop panel. Live Spaces reuse comment rows/forms in an accessible dialog with focus restoration.

## Durable Spaces

The [Spaces foundation](spaces.md) uses explicit membership, targeted invitations and canonical post/photo references in the existing private backend. Event metadata adds time zone/location/RSVP to the same model. Current membership and personal blocks apply at every resource boundary; independent feed preferences never grant access. Space mutations serialize with archive, membership changes and photo-slot reservations. Client components consume server DTOs and explicit HTTP action ports, independently of the development preview provider.

Space posts retain the existing 30-day lifetime and comments expire with their parent. Archive is read-only and preserves event metadata until deletion. Space photographs share the global three-upload ledger but stay out of personal Gallery; 20 retained canonical images per Space are enforced server-side. Trusted lifecycle routines retire only assets with no valid post or Gallery references. The separate minute-by-minute maintenance worker runs expiry, physical deletion and invitation reconciliation; deployment and health monitoring are documented in [scheduled maintenance](../src/server/jobs/README.md).

## Local posting and media rules

- The member backend uses each account's saved IANA time zone for three regular posts or one exclusive link-containing post per calendar day. Changing zones carries recent usage forward for at least 24 hours; the fictional preview retains its fixed Los Angeles clock.
- Posts and Gallery share a three-photograph daily allowance.
- A post photograph enters Gallery and counts once; a photograph already added that day can be reused without charging it again.
- Gallery holds at most 20 owned photographs with three featured entries.
- Editing preserves post identity, date, expiry, discussion and publication-day zone. Deleting a post preserves Gallery photographs and its publication allowance charge.

The local model validates preview changes together. The backend enforces member publication/photograph allowances inside authenticated database transactions with per-member locks and durable usage markers.

Device photographs are checked for format, size and dimensions; supported server uploads are decoded and re-encoded with metadata stripped. This is privacy processing, not harmful-content moderation. Animated images and motion photos are rejected. Accepted preview files use browser object URLs with cleanup and are never uploaded by the preview. Server image DTOs and remote image hosts remain allowlisted.

The [repository review](repository-review.md) documents founder-only report review, explicit public Event administrator assignment, accepted-friend Space invitations, migration effects and remaining operational verification.

## Server integrations

Clerk supplies account sessions. Prisma/PostgreSQL owns persistent data. The candidate private-social migration adds separate account activation, canonical friendship pairs, directional blocks, posts, canonical photos and gallery/post references while preserving the existing identity/music tables. Local music access uses a restricted development adapter; see [music setup](music-search.md).

The shared `src/server/auth.ts` boundary verifies Clerk's signed request identity, then reads the current provider session and user after a distributed per-subject rate gate. It checks session ownership, active status, expiration/abandonment, user availability and verified primary email. React caching is request/render-scoped; no cross-request revocation cache is used. Provider or Redis failures deny access with sanitized recovery. Proxy protection is an early boundary; APIs and server actions still authenticate independently and domain services retain their ACTIVE-account authorization checks.

PostgreSQL owns Margin onboarding, display name, unique lowercase username, bio, age confirmation and PENDING/ACTIVE/DEACTIVATED status. `User.clerkId` is the immutable unique identity link; neither email nor editable Clerk metadata can link or activate an account. Invitation claim, canonical profile persistence, immediate ACTIVE membership and immediate release of the inviter’s occupied slot share one serializable transaction with per-subject locking and bounded conflict retries. A guarded, operator-only command remains for first-founder bootstrap and reviewed legacy PENDING recovery. No public activation endpoint or custom password/session store exists. The [invitation model](account-flows.md#invitation-membership-model) adds recoverable 30-day links, a limit of three active personal invitations derived from link state, a database founder role, atomic community capacity and durable Clerk revocation reconciliation. Shared links never grant membership directly; individual email verification, accepted provider invitation and completed profile/age setup remain required.

The `/app` layout checks server authentication and wraps private UI in a client session monitor. It checks `/api/auth/session` on entry, visible focus/online, and every visible minute; ended, switched, degraded or unverifiable sessions hide private content. The probe independently authenticates and checks database deactivation, returns no token/email, and is never cached. Client hiding supplements server authorization; it does not undo completed or already-authorized in-flight requests. See [account flows](account-flows.md) for recovery and hosted verification gates.

The [disabled private-backend slice](private-backend-slice.md) puts session identity, active-account checks, resource authorization, current friendship/block rules, origin checks, validation, rate limits and transactional allowances behind real API handlers. Private photos bypass the public image optimizer. Hosted Clerk, R2 and Redis verification remains a rollout gate; no service accounts or production database were provisioned for this implementation.

The [OpenMLS experiment](../experiments/openmls/README.md) has its own Cargo project and browser harness. It is not imported by application code and does not change messaging or the Next.js CSP.

Scheduled work has a type contract but no executable provider or public job endpoint. Add scheduling only with authenticated invocations, validated payloads, bounded work, and idempotent database operations.

## Styling and accessibility

[The stylesheet guide](../src/styles/README.md) defines the ordered CSS manifest and selector ownership. Body and form text use Inter; headings and branding use Caudex. Parchment, Ink, Citron, and Blackened Olive are shared tokens.

Retain explicit labels, keyboard access, visible focus, 44px minimum interactive targets, reduced-motion alternatives, and device safe areas. Public content, development fixture assets, and future private user media remain separate.

## Authenticated member experience

`MemberService` extends `SpaceService` and `SocialService`, retaining their canonical accounts, transactions, locks, post/media lifecycles and audience checks. `/app` (Profile), `/app/feed`, `/app/gallery`, `/app/friends`, `/app/messages`, `/app/settings` and `/app/spaces` use real server read models and explicit HTTP actions. Shared profile sections, music picker, gallery editor, composer, message log/form, friendship controls, navigation and styles also serve the approved development interface. Founder and regular-member screens are the same; invitation privileges remain server controlled in Friends.

Active members can search introductions by name/username. Friend-list dates come from the current pair’s retained acceptance notification, which is cleared on unfriend/block; missing legacy dates remain unknown rather than using a profile’s creation or activity time. Only self or an accepted, unblocked friend receives personal posts, gallery references and music. The separately authorized profile portrait route returns a 208px crop to active unblocked members; it does not grant access to the original. Profile names/bios, portrait references, a permanent one-change username allowance, reading/motion preferences and notification choices persist on the existing Account. Gallery ordering/featuring/deletion uses an owner lock and optimistic version; stale saves fail without replacing newer entries.

Personal and Space composers share bounded JSON/multipart transport and photo staging. Personal composers read `/api/posts/allowance` when opened, using the same server query that enforces publishing limits; unavailable allowances require retry before publishing. Publishing normalizes every new photograph before committing the post and attachments atomically, and retains existing personal/Space quotas. Failed batches leave deletion tombstones for cleanup. Saved photographs still require ownership and a surviving authorized reference. Expired or removed Space references cannot be revived through the personal library. Private originals always use authenticated `/api/photos/[id]`, bypassing Next's public optimizer. Explicit deletion clears portraits and canonical references; post deletion preserves Gallery/portrait references.

Participant messages live in `MemberMessage`; Notebook is a self-addressed thread. The intended visibility policy is 30 days from each message’s send time and 90 days from each Notebook note’s save time; subsequent entries do not renew older ones. Shared thread notices and public retention guidance record this policy. Automatic message/note expiry and physical purge are not implemented yet and remain launch requirements. New delivery requires an accepted unblocked friendship, while participants can retain their prior history after unfriending. Each sender's request UUID makes an unchanged delivery retry idempotent. Clearing history affects only the caller's copy. Cursors, read anchors, reports and conversation exports are participant scoped. Client drafts/request IDs survive client navigation within the member session; they reset on reload/sign-out. Permission denials clear stale open content. Polling refreshes conversations, inbox summaries and activity while visible; these are not push notifications.

`MemberNotification` records actual friendship/comment/reply/like/message activity, with deduplication, current audience/block checks, read state and account preferences. Arrival animation respects reduced motion and remembers already-seen IDs across member navigation. Account/conversation exports are bounded, privately cached, separately rate limited, and exclude credentials/object keys. Selected account exports support JSON/photograph ZIP and readable PDF. Deactivation uses the existing service; it does not claim to erase Clerk identities or backups.

The authoritative [onboarding and activation rules](account-flows.md#invitation-onboarding-and-activation) define immediate activation for verified personal/community invitees, three available invitation slots and atomic release of the sender’s occupied personal slot; joining creates no friendship. Operator activation is limited to first-founder bootstrap and reviewed legacy PENDING recovery. Incomplete, legacy PENDING and DEACTIVATED accounts retain their access restrictions. Every new member API reuses verified server identity, ACTIVE checks, origin validation, bounded input, Redis limits and private response headers. Dependency failures fail closed. No preview identity header or client role grants access.

`20261104000000_member_experience` adds these account fields, Gallery positions/versioning, messages, notifications and likes. It was applied only to the backed-up local development database. `MARGIN_LOCAL_PHOTO_STORE=1` enables private filesystem bytes under ignored `.local/private-photos` **only in development**; production rejects that flag and retains the existing private R2 adapter. No cloud service was provisioned. Hosted storage, cleanup scheduling, production activation and real-device verification remain rollout work.
