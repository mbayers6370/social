# Architecture

## Module boundaries

- `src/app/` owns routing, metadata, server-rendered layouts, and API handlers.
- `src/features/` owns feature presentation, client-safe schemas, and local interaction state.
- `src/components/ui/` contains owned Radix/shadcn-style primitives. Shared layout and branding live in their corresponding component folders.
- `src/lib/` contains shared validation, media policy, and small utilities.
- `src/server/` contains server-only data access, integrations, authorization, security, and development fixtures.

Routes pass explicit data objects to feature components. Keep secrets and database operations out of client modules. Add client boundaries only where interaction requires them; lazy-load editors and dialogs when appropriate.

## Development and production

The root layout installs the local preview provider only in development. Fictional social data comes from server fixtures and is serialized into that provider. Production renders the public website and excludes development fixture routes and music APIs.

The local provider keeps posts, galleries, friendships, notifications, and preferences in memory across navigation. Messages keeps separate screen-local messages and drafts. Refresh resets social preview state; optional local music persistence is the exception.

The preview identity is fictional and is not authenticated production access. All real writes must derive identity on the server and check authorization again at the resource boundary.

## Shared post rendering

`PostCard` is the reusable post article. It accepts server-rendered author/content children and local action slots. `PostFooter` provides expiry details and the trailing Conversation action; profile owners also receive Edit. Feed and profile posts share the same action placement.

The main feed excludes the viewer's own posts. Profile posts share one Recent posts card with full-width separators. Photos precede text and open through shared image viewers. Profile conversations flip in place on desktop; feed conversations use an adjacent desktop panel. Mobile uses a full-screen conversation view with Back, focus restoration, and reduced-motion support.

## Local posting and media rules

- Each Los Angeles calendar day permits three regular posts or one exclusive link-containing post.
- Posts and Gallery share a three-photograph daily allowance.
- A post photograph enters Gallery and counts once; a photograph already added that day can be reused without charging it again.
- Gallery holds at most 20 owned photographs with three featured entries.
- Editing preserves post identity, date, expiry, and discussion. Deleting a post preserves Gallery photographs.

The local model validates these rules and applies related changes together. Authoritative production enforcement still requires authenticated database transactions.

Device photographs are checked for type, signature, size, dimensions, and description. Animated images and motion photos are rejected. Accepted files use browser object URLs with cleanup; they are never uploaded by the preview. Server image DTOs and remote image hosts remain allowlisted.

## Server integrations

Clerk supplies account sessions. Prisma/PostgreSQL owns persistent data; the current schema supports users and profile songs, with committed migrations. Local music access uses a restricted development adapter; see [music setup](music-search.md).

Server helpers cover private R2 storage, Redis-backed limits, request security headers, and filtered Sentry reporting. These adapters do not imply completed production social endpoints or provisioned accounts. Resource authorization, validation, and limits belong on server operations, not only in UI controls.

Scheduled work has a type contract but no executable provider or public job endpoint. Add scheduling only with authenticated invocations, validated payloads, bounded work, and idempotent database operations.

## Styling and accessibility

[The stylesheet guide](../src/styles/README.md) defines the ordered CSS manifest and selector ownership. Body and form text use Inter; headings and branding use Caudex. Parchment, Ink, Citron, and Blackened Olive are shared tokens.

Retain explicit labels, keyboard access, visible focus, 44px minimum interactive targets, reduced-motion alternatives, and device safe areas. Public content, development fixture assets, and future private user media remain separate.
