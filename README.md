# Margin

Margin is an invitation-only social application for personal posts, photographs, friendships, shared Spaces, and private conversations.

This repository contains the public website, authenticated member application, development previews, and supporting backend services. The member application uses server-verified identity and PostgreSQL persistence. Development previews use fictional, tab-local data and do not grant access to member resources.

## Technology stack

| Layer          | Technologies                          |
| -------------- | ------------------------------------- |
| Application    | Next.js App Router, React, TypeScript |
| Interface      | Radix UI, CSS design tokens           |
| Persistence    | PostgreSQL, Prisma                    |
| Authentication | Clerk                                 |
| Rate limiting  | Upstash Redis                         |
| Private media  | Cloudflare R2                         |
| Observability  | Sentry                                |
| Testing        | Vitest, Testing Library, Playwright   |

## Getting started

### Requirements

- Node.js 22.12 or later within the Node 22 release line. `.nvmrc` and `.node-version` declare the supported version.
- npm for dependency installation and project scripts.
- PostgreSQL and provider configuration for authenticated member development.

### Install and run

```sh
nvm use
npm ci
npm run dev
```

The development server runs at [localhost:3000](http://localhost:3000). `/welcome` serves the public website. Development-only previews cover Feed, Profile, Friends, Gallery, Messages, and Settings, with additional routes at `/design-system` and `/preview/spaces`.

Preview state persists during navigation within a tab and resets on refresh. Preview uploads remain in browser memory. Production `/` serves the public website, and development preview routes are unavailable in production.

### Local production review

Use one production-optimized review build for desktop and phone UI/UX checks:

```sh
npm run review
```

For Clerk sign-in and account review on this Mac at `http://localhost:3000`, use
`npm run review -- --localhost`. This builds the same production-optimized source
with the existing local Clerk account and database, and binds only to localhost.
Use Node 22 (`nvm use`) and stop any existing server on port 3000 first.

This command replaces its isolated `.local/local-review/next` output, builds the
current root source, and prints one private-network HTTPS address to use on both
devices. It never copies or patches the source tree, and it never replaces the
standard `.next` output used by `npm start`. The review remains fail-closed
unless it has matching Clerk test keys, the known loopback `margin_local`
runtime database, and local private-photo storage. It is not a
hosted-production security check.

`npm run dev` hot-reloads changes, including CSS variables, while using the
configured real account backend. Production commands serve compiled snapshots:
`npm start` requires an unchanged `npm run build` output; `npm run review` builds
the current source before starting. Both now check build/source identity, and a
running local review shows an explicit out-of-date response on document reload
after source/configuration changes. Rebuild it rather than expecting production
hot reload. All supported server commands reject an occupied port across IPv4
and IPv6 and share a process lease instead of silently launching another site.
For signed-in UI changes, rebuild/restart and verify the actual `/app` route;
fictional previews do not establish that the running account app was updated.
Stop `npm run review` with Ctrl-C. To remove obsolete build,
test, trace, and review artifacts while preserving the local database, private
photographs, credentials, and Node toolchain, run:

```sh
npm run clean:local -- --apply
```

Repository copies and Git worktrees are forbidden under `.local`. Verification
uses the operating system temporary directory for its disposable source snapshot,
always removes that snapshot, and retains at most three small reports. Check the
guardrail at any time with `npm run local:check`; the command fails on unexpected
entries, nested Git metadata, excess reports, or more than 2 GiB of local data.

### Authenticated development

The member application requires:

- `MARGIN_PRIVATE_BACKEND_ENABLED=1`.
- Matching Clerk Development keys and a canonical application origin.
- A migrated development PostgreSQL database.
- Distributed rate limiting and private photo storage.

Use [account flows](docs/account-flows.md) for authentication, invitation setup, and activation requirements. The [local database guide](docs/music-search.md) documents the supported PostgreSQL setup. `npm run db:local` manages the existing isolated local cluster; migrations require review and explicit execution against the intended database.

## Configuration

[`.env.example`](.env.example) documents supported environment variables. Real environment files, credentials, local databases, and private working artifacts are excluded from Git. Prisma commands load `.env` explicitly. Installation does not provision remote services or apply database migrations.

| Integration   | Configuration                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Clerk         | Matching keys from one instance, canonical origin, Invite-only registration, email verification, and session policy |
| PostgreSQL    | Runtime `DATABASE_URL`; optional separate `MIGRATION_DATABASE_URL` for migration privileges                         |
| Upstash Redis | REST URL and read/write token; authentication and invitation operations deny access when unavailable                |
| Photo storage | Private R2 bucket and scoped credentials; a filesystem adapter is available only for local development              |
| Ticketmaster  | Server-only Discovery API key for explicit, cached event searches                                                   |
| Music catalog | On Repeat catalog search with authenticated persistence of member selections                                        |
| Sentry        | Optional DSN and project configuration; upload tokens restricted to trusted build environments                      |

Keep development and production credentials separate. Device testing uses exact hostnames in the ignored `MARGIN_DEV_ALLOWED_HOSTS` setting. Production rejects the local filesystem photo adapter.

Invitation and founder commands are guarded operator tools. Their usage is documented in [invitation membership](docs/account-flows.md#invitation-membership-model). Invitation URLs are credentials and must not appear in committed reports or logs.

## Application structure

| Area     | Member route    | Capabilities                                                                                              |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| Profile  | `/app`          | Profile editing, one lifetime username change after setup, On Repeat music, photographs, and recent posts |
| Feed     | `/app/feed`     | Friend and opted-in Space posts, publishing, likes, and conversations                                     |
| Friends  | `/app/friends`  | Mutual requests, member lookup, invitations, and relationship controls                                    |
| Gallery  | `/app/gallery`  | Private photograph upload, selection, ordering, and deletion                                              |
| Spaces   | `/app/spaces`   | Invitation-only Spaces with optional plans; public Event Spaces and invitations                           |
| Messages | `/app/messages` | Participant-authorized conversations, personal Notebook, pagination, and polling                          |
| Settings | `/app/settings` | Reading, motion, notifications, safety records, account controls, and data downloads                      |

The member application and previews share interface components, design tokens, and interaction patterns. Member requests independently enforce verified identity, account eligibility, ownership, and current audience permissions on the server.

### Membership and activation

The authoritative [onboarding and activation rules](docs/account-flows.md#invitation-onboarding-and-activation) define automatic activation after verified personal or community invitation and profile/age setup. Operator activation is reserved for first-founder bootstrap and reviewed legacy PENDING recovery. Registration remains separately gated by server configuration.

Active members can have three personal invitations open at a time. Completed acceptance, expiry, or withdrawal frees a slot. The server-owned founder role permits unlimited personal invitations and configurable community links. Invitations expire after 30 days; joining does not create a friendship automatically.

### Messaging and notifications

Messaging uses server persistence and polling. Members can disable messaging in Settings, which removes its navigation and denies reads and sends for both participants, including existing conversations. Re-enabling restores access to retained conversations and Notebook notes. Account exports remain available while messaging is disabled.

In-app notifications cover friendship activity, comments, replies, likes, messages, Space invitations, and new posts in invitation-only Spaces. Like notifications are off by default for new accounts and can be enabled in Settings. Space post notifications reach eligible active, unblocked members regardless of friendship; Event Space posts do not generate them. Push and email notification delivery are separate from the current implementation.

### Retention and media lifecycle

Messages are stored on the server and are **not end-to-end encrypted**. Messages expire after 30 days and Notebook notes after 90 days, measured from creation and enforced on reads and exports. Posts retain their original 30-day expiry after editing. Event Spaces become inaccessible 48 hours after their scheduled end; their initial four-hour duration is administrator-adjustable.

A dedicated maintenance worker runs each minute to hard-delete expired content and dependent records, reconcile Clerk invitations, and retry deletion of unreferenced private objects. Each photograph has one canonical database record and stored original, reused by ID across Gallery, portraits, posts, and Spaces. Removing one placement preserves other valid references.

Worker installation, health alerts, and hosted storage and backup verification are deployment requirements. See [scheduled maintenance](src/server/jobs/README.md) for operation and monitoring.

## Verification

The project provides focused checks and a complete verification workflow:

```sh
# Formatting, types, lint, stylesheet checks, and unit tests
npm run check

# Limit unit execution to a specific test file
npm run check -- tests/profile-posts-ui.test.tsx

# Complete verification required before pushing
npm run verify
```

`check` and `verify` run credential-free source snapshots in the operating system temporary directory, remove them on exit, and retain only bounded reports under `.local/verification/`, leaving the working development server undisturbed. Fast checks select the unit/component projects. Full verification retains real disposable PostgreSQL, security and integration checks, a production build, essential desktop/mobile browser journeys in development and production, and dependency audits. `npm run verify:extended` adds presentation exploration and Firefox/WebKit journeys. See [the testing guide](tests/README.md) and [audit evidence](tests/AUDIT.md) for the test levels, inventory and measurements. The pre-push hook still requires a clean working tree and full verification of the commit being pushed; GitHub Actions runs the same full workflow.

Install the browser dependency and local Git hook with:

```sh
npm run test:e2e:install
npm run hooks:install
```

Additional commands support targeted work:

| Command                                                                | Scope                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `npm run verify -- --code-only`                                        | Code checks, build, and audits; excludes DB and browsers |
| `npm run test:auth-db`                                                 | Authentication database integration tests                |
| `node scripts/test-social-db.mjs --space-invitations`                  | Space invitation database integration tests              |
| `npm run test:e2e -- tests/e2e/space-invitation-notifications.spec.ts` | Focused browser tests                                    |

Database runners create disposable databases in the existing loopback PostgreSQL cluster. They do not read `.env` or migrate the development application database. Direct browser tests normally start a local server on port 3100 with authentication and Sentry disabled. `PLAYWRIGHT_BASE_URL` accepts an existing loopback server; `PLAYWRIGHT_PRODUCTION=1` requires a production build.

The explicit opt-in commands `test:auth-redis:live`, `test:auth:live`, and `test:invitations:live` exercise configured development services with guarded disposable identities. Fixture tests do not establish actual provider session behavior or email delivery. Code-only verification does not replace the full push workflow.

Commit test sources and deterministic fixtures. Keep reports, screenshots, traces, coverage, build output, and logs in ignored locations such as `.local/`, `test-results/`, and `playwright-report/`. Failed verification runs retain their isolated reports locally.

## Repository layout

| Path                   | Responsibility                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| `src/app/`             | Public, member, development, and API routes                               |
| `src/features/`        | Feature components, client state, and client-safe schemas                 |
| `src/components/`      | Shared controls, layout, branding, and icons                              |
| `src/server/`          | Authorization, business rules, persistence, and provider adapters         |
| `src/styles/`          | Design tokens, base rules, and the ordered feature stylesheet manifest    |
| `prisma/`              | Database schema and migrations                                            |
| `tests/`               | Unit, integration, and browser tests                                      |
| `scripts/`             | Verification, local database management, and guarded operator tools       |
| `experiments/openmls/` | Isolated encryption feasibility work, separate from application messaging |

## Documentation

| Reference                                          | Contents                                                     |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [Architecture](docs/architecture.md)               | Application boundaries, identity, persistence, and APIs      |
| [Account flows](docs/account-flows.md)             | Authentication, invitations, activation, and hosted checks   |
| [Spaces](docs/spaces.md)                           | Optional plans, membership, permissions, and event discovery |
| [Private backend](docs/private-backend-slice.md)   | Backend authorization, API contracts, and media lifecycle    |
| [Stylesheet conventions](src/styles/README.md)     | CSS ownership, tokens, and interface conventions             |
| [Scheduled maintenance](src/server/jobs/README.md) | Retention, reconciliation, worker setup, and monitoring      |

## Deployment status

The intended production domain is `margin.social`; the general support address is `support@margin.social`. Local functionality and fixture tests do not establish hosted production readiness.

Launch requires reviewed production migrations, provider and domain configuration, real-service integration evidence, private storage permissions, maintenance worker deployment and monitoring, backup and restoration procedures, moderation operations, complete identity-provider account erasure, and final policy review. The OpenMLS experiment does not provide encryption guarantees for application messaging.

Public registration, infrastructure provisioning, deployment, and production database changes require explicit operational authorization. Development preview access must remain private.
