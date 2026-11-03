# Margin

Margin is an invitation-only social application for personal posts, photographs, friendships, shared Spaces, and private conversations. The application uses Next.js App Router, React, TypeScript, Prisma, PostgreSQL, Clerk, and Radix UI.

## Application status

The authenticated member application under `/app` uses server-derived identity and PostgreSQL read models. Its interface shares components, design tokens, and interactions with the development previews; preview identities and browser state never authorize member access.

| Area     | Member route    | Current implementation                                                                                         |
| -------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| Profile  | `/app`          | Profile editing, one lifetime username change after setup, On Repeat music, photographs, and recent posts      |
| Feed     | `/app/feed`     | Friend posts and opted-in Space posts, publishing, likes, and conversations                                    |
| Friends  | `/app/friends`  | Mutual friend requests, member lookup, invitation sharing, and relationship controls                           |
| Gallery  | `/app/gallery`  | Private photograph upload, selection, ordering, and deletion                                                   |
| Spaces   | `/app/spaces`   | Private Spaces, Gathering Spaces, public member Event Spaces, invitations, and Ticketmaster event discovery    |
| Messages | `/app/messages` | Participant-authorized conversations, a personal Notebook, pagination, and polling                             |
| Settings | `/app/settings` | Reading and motion preferences, notification preferences, safety records, account controls, and data downloads |

Notifications include friendship activity, comments, replies, likes, messages, Space invitations, and new posts in Private and Gathering Spaces. Space post notifications reach other active, unblocked members regardless of friendship; Event Space posts do not generate them. Comment and reply links open the relevant post conversation. Help and other public information pages retain the signed-in navigation without ending the session.

Membership registration is invitation-only and controlled by both Margin and Clerk. A valid invitation, verified identity, and completed profile are required for automatic activation. Regular members receive three personal invitations in total when activated; the server-side founder role permits unlimited personal invitations and configurable community links. Invitations expire after 30 days. Joining Margin does not create a friendship automatically. Registration remains separately gated by server configuration; credentials alone do not open it.

Messaging is enabled by default. Settings can turn it off, hiding message navigation and profile actions and denying messaging reads and sends on the server for both participants, including existing conversations. Re-enabling restores access to available conversations and Notebook notes; opting out does not erase them. Account data exports remain available while messaging is off.

Messages are stored on the server and are **not end-to-end encrypted**. The stated retention policy is 30 days for messages and 90 days for Notebook notes, measured from each entry's creation. Automatic message/note expiry and physical cleanup remain launch requirements; the interface describes these lifetimes as intended behavior. Post edits retain the original post expiry. Event Spaces become inaccessible 48 hours after their scheduled end, with an initial four-hour event duration that administrators can change.

The intended production domain is `margin.social`; the general support address is `support@margin.social`. Hosted production activation, operational readiness, and final legal review remain separate release gates. Local functionality and fixture tests do not establish hosted production readiness.

## Local development

Node 22.12 or later within the Node 22 release line is required. `.nvmrc` and `.node-version` select the supported release line.

```sh
nvm use
npm ci
npm run dev
```

The development server runs at [localhost:3000](http://localhost:3000). Development-only previews include Feed, Profile, Friends, Gallery, Messages, Settings, `/design-system`, and `/preview/spaces`. Fictional preview state survives navigation within a tab and resets on refresh. Preview uploads remain in browser memory. `/welcome` provides the public website; production `/` serves the public site and excludes development preview routes.

The member application requires `MARGIN_PRIVATE_BACKEND_ENABLED=1`, matching development Clerk keys, a migrated development database, distributed rate limiting, and private photo storage. [Account flows](docs/account-flows.md) documents provider restrictions, invitation setup, session behavior, activation, and hosted checks. The supported local PostgreSQL setup is documented in [local database setup](docs/music-search.md).

## Configuration

`.env.example` lists supported variables. Real environment files, credentials, and local databases are ignored by Git. Prisma commands load `.env` explicitly; no remote provisioning or migrations run automatically.

| Integration         | Configuration and boundary                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clerk               | Matching publishable and secret keys from one instance, canonical app origin, Invite-only mode, email verification, and session/recovery configuration |
| PostgreSQL          | Runtime `DATABASE_URL`; optional separate `MIGRATION_DATABASE_URL` for migrations                                                                      |
| Upstash Redis       | REST URL and read/write token for distributed limits; protected authentication and invitation operations fail closed when unavailable                  |
| Photo storage       | Private Cloudflare R2 bucket and scoped credentials; an explicit filesystem adapter is available only for local development                            |
| Ticketmaster        | Server-only Discovery API key; event search is explicit and cached                                                                                     |
| Apple Music catalog | On Repeat catalog search; member selections use authenticated persistence                                                                              |
| Sentry              | Optional DSN and project configuration; upload tokens belong only in trusted build environments                                                        |

`npm run db:local` manages the existing isolated local PostgreSQL cluster. Migration changes require review and explicit execution against the intended development database. Production credentials and databases must remain separate. Device testing uses exact hostnames in the ignored `MARGIN_DEV_ALLOWED_HOSTS` setting, without committing network addresses.

Invitation and founder commands are manual operator tools. Their help and safeguards are documented in [invitation membership](docs/account-flows.md#invitation-membership-model). Invitation URLs are credentials and must not appear in committed reports or logs.

## Verification

Focused checks run in an isolated, credential-free copy under `.local/` and leave an open development server undisturbed:

```sh
npm run check -- tests/profile-posts-ui.test.tsx
node scripts/test-social-db.mjs --space-invitations
npm run test:e2e -- tests/e2e/space-invitation-notifications.spec.ts
```

`npm run check` includes formatting, type generation/type checking, lint, stylesheet ownership checks, and unit tests. Supplying test paths limits unit execution to the affected files. Database runners use a fresh disposable database in the existing loopback PostgreSQL cluster; they never migrate the development application database or read `.env`. Browser tests normally start a credential-free server on port 3100. `PLAYWRIGHT_BASE_URL` accepts an existing loopback server; `PLAYWRIGHT_PRODUCTION=1` requires a production build.

The pre-push hook and CI run the complete `npm run verify` workflow: disposable PostgreSQL tests, formatting, types, lint, styles, unit tests, production build, development and production browser checks, and dependency audits. The hook requires a clean working tree and verifies the commit being pushed. Installation commands:

```sh
npm run test:e2e:install
npm run hooks:install
```

`npm run verify -- --code-only` includes code checks, build, and dependency audits, excluding database and browser suites. It does not replace the full push workflow. `npm run test:auth-db` runs focused authentication database checks. Explicit opt-in commands `test:auth-redis:live`, `test:auth:live`, and `test:invitations:live` exercise configured development services with guarded disposable identities. Fixture-based authentication tests do not establish actual Clerk session or email delivery behavior.

Test source and deterministic fixtures belong in Git. Working notes, verification reports, screenshots, traces, coverage, build output, and logs belong in ignored locations, principally `.local/`, `test-results/`, and `playwright-report/`. Failed verification runs retain their isolated reports locally.

## Repository layout

- `src/app/`: public, member, development, and API routes.
- `src/features/`: feature components, client state, and client-safe schemas.
- `src/components/`: shared controls, layout, branding, and icons.
- `src/server/`: authorization, business rules, persistence, and provider adapters.
- `src/styles/`: shared tokens, base rules, and the ordered feature stylesheet manifest.
- `prisma/`: database schema and migrations.
- `tests/`: unit, integration, and browser tests.
- `scripts/`: verification, local database, and guarded operator tools.
- `experiments/openmls/`: isolated encryption feasibility work; not part of application messaging.

Project references include [architecture](docs/architecture.md), [account flows](docs/account-flows.md), [Spaces](docs/spaces.md), [private backend boundaries](docs/private-backend-slice.md), and [stylesheet conventions](src/styles/README.md).

## Release boundaries

Launch requires production provider/domain configuration and integration evidence, reviewed production migrations, private storage permissions, reliable retention/cleanup jobs, backup and restoration procedures, moderation operations, complete identity-provider account erasure, and final policy review. Push/email notification delivery and stronger realtime messaging are separate from the current polling-based application. The OpenMLS experiment does not provide application encryption guarantees.

Public registration, paid infrastructure provisioning, deployment, and production database changes are explicit operational decisions. Development preview access must not be exposed publicly.
