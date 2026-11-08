# Margin

Margin is an interactive portfolio demo of a small social space for friends: a chronological feed with an ending, personal profiles, photographs, conversations and Spaces. Enter as Ines, a fictional member, and explore without registering.

The public demo is the default application in this repository. The original full-stack implementation remains alongside it as engineering work, including authentication, PostgreSQL/Prisma, private media, authorization and scheduled maintenance. Those services are excluded from the public demo.

## Run the demo

Use Node 22, matching `.nvmrc`:

```sh
nvm use
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000), then choose **Explore Demo**. There is no sign-in step. Source changes hot-reload; refreshing starts a fresh demo session. Installation generates the preserved Prisma client without connecting to or migrating a database. No `.env` file, service credentials or provider accounts are needed for the demo.

To review the actual static export, stop the development server first:

```sh
npm run build
npm start
```

The guarded commands keep one server on the requested port, prevent rebuilding assets used by a running demo server, and reject stale static output. If you already have `npm run dev` running in a terminal, leave it running during ordinary source edits; stop it yourself before an in-place export build.

## What visitors can try

| Area                  | Demo interactions                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Feed                  | Browse fictional posts, compose and edit posts, comment, react and reach the end of the feed     |
| Profiles and friends  | Visit fictional accounts, edit Ines’s profile, change Top 4 and accept a sample friend request   |
| Gallery               | View photographs and arrange the bundled photo library                                           |
| On Repeat             | Expand song details, choose from a predefined catalogue and open ordinary external Spotify links |
| Messages and Notebook | Write local messages and notes, with separate drafts and conversations                           |
| Spaces                | Explore fictional groups and plans, change local settings and join discussions                   |
| Preferences           | Try reading sizes, motion preferences, notification controls and responsive navigation           |

Ines, Theo, June, Samuel, Mara and Nadia use the existing fictional content and shared application components. The sample day stays on 28 October 2026 so content remains populated as the portfolio ages. Ines’s On Repeat is “Je veux” by Greg Gontier, with the supplied Grégoire cover bundled locally and a direct Spotify link. Other sample covers are original illustrations. No audio is streamed or embedded.

Changes live in React memory within one tab, survive navigation inside `/demo/`, and reset on refresh or **Exit demo** in the profile menu. Exiting clears the session before returning to the welcome page; browser-history restoration starts with fresh sample data. Visitors do not share state. Optional downloads stay on the visitor’s device until they delete those files.

The public information pages are **Why Margin**, **How it works**, **Your data** and **Retention**. Asset acknowledgements remain in Your data, and font licenses are bundled.

## What was excluded from the public demo

| Excluded from the public build                                  | Demo behavior                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Clerk registration, authentication and real accounts            | Anonymous entry through Explore Demo                                    |
| PostgreSQL, Redis and production APIs                           | Fictional definitions and in-memory interactions                        |
| R2 and private media delivery                                   | Bundled sample photographs; device uploads are unavailable              |
| iTunes/Apple Music catalogue requests and attribution badge     | Predefined song information, bundled artwork and ordinary music links   |
| Ticketmaster and live event discovery                           | Fictional Spaces and plans                                              |
| Sentry, analytics and background workers                        | No runtime telemetry or scheduled service integration                   |
| Real message delivery, invitation emails and account operations | Local simulations or explicit unavailable-operation notices             |
| Support forms and legal-policy routes                           | A smaller portfolio navigation with demo data and retention information |

These exclusions apply to the public target. Backend code, authentication, Prisma models and migrations, production music integration, support/legal documents and application features remain in the repository. The demo does not grant access to them.

## Isolation and privacy

The separate `portfolio/` Next.js application exports `/`, `/demo/` and the retained information pages. It does not export `/app`, authentication, administrative or API routes.

Its build strips service credentials, rejects backend/integration imports, copies an explicit public-asset allowlist, and checks the export for credential-shaped content, private files and source maps. Before hydration, the browser boundary permits only known static pages/assets and blocks unexpected paths, network mutations, external requests, XHR, EventSource and beacons. WebSockets are blocked in the export; development permits only Next.js’s same-origin hot-reload channel. Allowed fetches omit cookies, authorization and referrers.

This is application isolation, not a promise of zero network metadata. A static host receives ordinary page and asset requests and may keep operational logs. Music links contact external services when a visitor opens them. Use a separate demo origin without production cookies, API forwarding or injected analytics, and avoid entering sensitive information during a portfolio session. Live host configuration still needs verification before release.

## Deploy the static demo

The deployable output is **`portfolio/out/`**. It contains static HTML, JavaScript, CSS, images, font licenses, robots/sitemap files, a real `404.html` and generated `_headers`. Build output and local ZIP packages are generated artifacts, not source files to commit. Deploy only the export, never the repository root, `portfolio/.next`, `.env`, local databases or private media.

### Render Static Site

Render supports Next.js static exports as [Static Sites](https://render.com/docs/deploy-nextjs-app#deploy-as-a-static-site). Use these settings after reviewing and pushing the demo source to the intended Git branch:

| Setting                     | Value                                           |
| --------------------------- | ----------------------------------------------- |
| Service type                | Static Site                                     |
| Branch                      | The reviewed branch containing the demo changes |
| Root directory              | Leave blank: repository root                    |
| Build command               | `npm ci && npm run demo:build`                  |
| Publish directory           | `portfolio/out`                                 |
| Node version                | 22, as specified in `.nvmrc`                    |
| Start command               | None                                            |
| Runtime service credentials | None                                            |

**Render response headers still require configuration before release.** The exported `_headers` file is for Cloudflare Pages. Configure equivalent [Render response headers](https://render.com/docs/static-site-headers), including the CSP with hashes from the exact export and the `/demo/*` noindex policy. Inline-script hashes can change with a build; keep the hosting configuration synchronized with each release. Do not add a catch-all SPA rewrite: missing `/api`, `/app` and removed information routes must remain 404 responses.

Review the separate `onrender.com` preview before any domain cutover: welcome → demo → Exit demo, desktop/mobile layouts, isolated visitor sessions, no API/external calls during normal use, response headers and genuine 404s. A Render-hosted release has not yet been verified. Static hosting still has provider bandwidth/build quotas; see [Render’s static-site documentation](https://render.com/docs/static-sites).

### Cloudflare Pages alternative

The same export is prepared for Cloudflare Pages: repository root, build command `npm ci && npm run demo:build`, output `portfolio/out`, Node 22, and no Functions, Workers, bindings or service credentials. Pages can apply the generated `_headers` directly. Review a separate `pages.dev` preview before any domain change.

Deployment, DNS changes, provisioning and charges require separate approval. If an existing `margin.social/*` Worker forwards to a full-stack origin, review that route before a domain cutover; the [preserved application edge runbook](ops/cloudflare/README.md) documents that separate architecture. No hosting or DNS change is made by building the demo.

## Full-stack capabilities retained in the source

The original application supplies the backend engineering behind the shared interface. These capabilities are implemented in the preserved target and are not connected to public demo sessions. Hosted-provider verification and operational deployment remain separate release work.

| Capability                  | Preserved implementation                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Identity and membership     | Clerk session verification, invitation-based onboarding, account eligibility and server-side authorization     |
| Relational data             | PostgreSQL/Prisma schema, migrations, constraints, transactions and concurrency controls                       |
| Social features             | Friendship/block boundaries, posting allowances, comments, reactions, profiles, Top 4 and notifications        |
| Private media               | Canonical photo references, private R2 storage, authorized delivery, upload validation and cleanup             |
| Spaces                      | Membership, invitations, discussions, photograph references, plans and lifecycle rules                         |
| Messaging                   | Server-stored conversations, Notebook and authorization; messages are not end-to-end encrypted                 |
| Data lifecycle              | Expiry enforcement, a separate scheduled-maintenance worker, account exports and erasure workflows             |
| Integrations and operations | Production music catalogue, live event adapter, Redis abuse controls, optional Sentry and guarded local review |
| Verification                | Unit/component tests, disposable PostgreSQL integration tests, browser regressions and dependency audits       |

These are retained source capabilities, not claims that live providers have been provisioned, all release checks have passed on a public host, or the demo delivers real messages.

To work on the preserved application explicitly, configure its own environment using [`.env.example`](.env.example), then use:

```sh
npm run app:dev
# Or, after stopping that server:
npm run app:build
npm run app:start
```

For production-optimized account review on this Mac with local Clerk test credentials, use `npm run review -- --localhost`. Keep hosted authentication safeguards intact. Database setup and migrations are separate operator actions; the static demo needs neither. See [account flows](docs/account-flows.md), [private backend](docs/private-backend-slice.md), [Spaces architecture](docs/architecture.md#durable-spaces), [account erasure](docs/account-erasure.md) and [scheduled maintenance](src/server/jobs/README.md).

## Verification

```sh
# Formatting, types, lint, stylesheet ownership and unit/component tests
npm run check

# Actual static-export journeys on desktop and mobile; build first, with dev stopped
npm run demo:test

# Default hot-reloading welcome → demo entry on desktop and mobile
npm run demo:test:dev

# Full project gate required before pushing
npm run verify
```

Install Chromium with `npm run test:e2e:install`. The full gate checks the preserved application and demo independently: isolated PostgreSQL, both builds, static-export browser journeys, demo startup, full-stack development/production browser suites and dependency audits. It uses credential-free temporary source snapshots and leaves the user’s development server running. Extended browser coverage is available through `npm run verify:extended`.

Local demo checks do not prove Render/Cloudflare response headers, DNS, provider configuration or an authenticated production account. See [Testing Margin](tests/README.md) for test scope and exclusions. Generated-artifact policy checks are `npm run local:check` and the supported `npm run clean:local -- --apply` cleanup.

## Repository guide

| Path                                              | Responsibility                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `portfolio/`                                      | Default public demo routes and isolated static-export configuration            |
| `src/features/public-demo/`                       | Demo composition, exit/reset, information pages and browser network boundary   |
| `src/fixtures/`                                   | Fictional content shared with the existing development previews                |
| `src/features/`, `src/components/`, `src/styles/` | Shared interfaces, local state, controls and visual system                     |
| `src/app/`, `src/server/`                         | Preserved full-stack routes, APIs, authorization, persistence and integrations |
| `prisma/`                                         | Preserved database schema and migrations                                       |
| `tests/`, `scripts/`                              | Verification, guarded application commands and operator tools                  |
| `public/fonts/`, `src/assets/`, `design/`         | Bundled assets, licenses and original design sources                           |
| `ops/`                                            | Preserved full-stack deployment examples; not required by the demo             |

Start with the [demo target](portfolio/README.md), [architecture](docs/architecture.md), [feature boundaries](src/features/README.md) and [shared style conventions](src/styles/README.md). Backend and integration documentation is retained as technical reference for the original application.
