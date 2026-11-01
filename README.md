# margin

A minimal social interface built with Next.js App Router, React, TypeScript, Tailwind, and Radix components.

## Development

Use Node 22.12 or newer within the Node 22 release line; `.nvmrc` and `.node-version` select it.

```sh
nvm use
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Development includes the feed, Messages, Profile, Friends, Gallery, Settings, and `/design-system`, using fictional accounts without cloud credentials. `/welcome` previews the public website.

Social posts, messages, uploads, friendships, preferences, and drafts are local previews. State, including added messages and unsent drafts, survives navigation within the tab and resets on refresh. Uploaded photographs stay in browser memory and are never sent to a server.

On Repeat supports live Apple catalogue search and optional local PostgreSQL persistence. See [local music setup](docs/music-search.md).

Production serves the public website and excludes development accounts and routes. Registration is closed. Public legal pages are drafts; the legal operator and working support address must be supplied before launch.

## Optional services

Copy `.env.example` to `.env` and configure only the services you use. Real environment files are ignored; commit placeholder examples only.

For phone testing, set `MARGIN_DEV_ALLOWED_HOSTS` to exact hostnames in your ignored `.env`. Keep personal network addresses out of source control. Production does not include these development origins.

- **Clerk:** authentication keys and the canonical app origin. Configure domains, redirects, and account policy in Clerk.
- **PostgreSQL:** `DATABASE_URL` for Prisma. Review migrations before running `npm run db:migrate` against the intended development database.
- **Cloudflare R2:** private bucket and scoped credentials. The disabled private-backend slice includes upload/delivery adapters; hosted bucket permissions remain unverified.
- **Upstash Redis:** REST endpoint and token for server rate limits.
- **Sentry:** DSN and project settings; use an upload token only in trusted build environments.

Prisma scripts load `.env` explicitly. The optional local database command uses its own isolated cluster; see the music guide. No cloud provisioning or remote migrations run automatically.

## Checks

For everyday edits, run the quick checks. Optionally name the unit test files relevant to the change:

```sh
npm run check
npm run check -- tests/profile-presentation.test.tsx tests/profile-posts-ui.test.tsx
```

Quick checks run formatting, types, lint, styles and unit tests in an isolated copy. They skip the production build, database tests, browser suites and dependency audits. Use focused checks while editing; run full verification at the push boundary rather than repeating it after every small change.

Before the first push from a clone, install the browser and hook:

```sh
npm run test:e2e:install
npm run hooks:install
```

Use the Node version in `.nvmrc` (`nvm use` if using nvm). The pre-push hook runs `npm run verify` automatically and stops a push on failure, so there is no need to run it manually immediately before pushing. Commit or stash changes first: it checks a clean working tree against the commit being pushed. It does not commit or push for you. CI independently runs the same full verification.

Full verification first runs the private-backend tests against a fresh disposable database in the existing local PostgreSQL cluster. Set up that cluster once using the [local database instructions](docs/music-search.md); `MARGIN_PG_BIN` can select your PostgreSQL bin directory. The test runner never reads or changes `.env`, migrates the preview database, or uses a remote database. CI uses its own disposable PostgreSQL service. Database verification is mandatory for a push.

The remaining verification uses an ignored temporary copy under `.local/` so an open development server can keep running. It excludes real environment files, disables live integrations, and runs formatting, types, lint, styles, unit tests, the production build, desktop/mobile browser tests in development and production, and both dependency audits. Development tests use a fixed server/browser clock. Failed runs retain local reports at the printed path; successful copies are removed.

The browser suite includes a classic-scrollbar project for conversation centering and responsive transitions. These are automated layout assertions, separate from manual visual review. CI uploads only the failed run's Playwright reports and test results for seven days, never the whole local directory. Publish fixes through a branch and wait for a successful GitHub run before merging them into `main`; local checks alone do not establish that the CI environment passes.

`npm run verify -- --code-only` remains available for a broader local check including the build and dependency audits but excluding database and browser suites. Neither quick nor code-only results authorize a push: the pre-push hook always runs the complete suite. Full verification requires the Node version declared in `.nvmrc`, matching CI. There is no quick or code-only push mode.

Individual checks are also available:

```sh
npm run format:check
npm run lint
npm run styles:check
npm run typecheck
npm test
npm run build
```

Browser tests are separate:

```sh
npm run test:e2e:install
npm run test:e2e
PLAYWRIGHT_PRODUCTION=1 npm run test:e2e
```

Playwright normally starts an isolated server on port 3100. To use an existing local development server, set `PLAYWRIGHT_BASE_URL=http://localhost:3000`; the override accepts loopback origins only. Production-mode tests require a production build. CI runs the configured checks and dependency audits.

Keep test source files and fixtures in Git. Generated reports, screenshots, traces, coverage, build files, logs, local databases, credentials, and local agent tooling are ignored.

## Structure

- [Architecture](docs/architecture.md): module boundaries, local state, and server responsibilities.
- [Account flows](docs/account-flows.md): invitation signup, profile controls, local safety records, downloads and remaining hosted integration.
- [Private backend slice](docs/private-backend-slice.md): closed account activation, authorization, photo lifecycle, tests, and rollout gates.
- [OpenMLS experiment](experiments/openmls/README.md): isolated browser feasibility harness, results scope, and unresolved production gates.
- [Styles](src/styles/README.md): CSS ownership, tokens, and interface conventions.
- [Brand assets](src/assets/brand/README.md): original artwork and shared branding components.
- `src/app/`: routes and layouts.
- `src/features/`: feature components and client-safe schemas.
- `src/components/`: shared components and layout.
- `src/server/`: server-only integrations, authorization, and fixtures.
- `prisma/`: database schema and migrations.
- `tests/`: unit, integration, and browser test source.

## Production boundaries

The social UI remains a development preview. A separate backend slice implements session-derived access for explicitly activated accounts, friendship/block transitions, private posts, protected photo delivery and deletion. It is disabled by default, has no preview UI connection, and requires hosted-provider verification before activation. Persistent production messages, moderation, exports, full identity-provider account erasure and scheduled maintenance remain incomplete. Music persistence uses a development-only actor and local database.

Do not expose the development server publicly. Production launch requires server-derived identity, resource authorization, transactional posting allowances, durable storage, configured service accounts, and live integration verification. Dependency versions belong in `package-lock.json`; use normal audited upgrades rather than forced major-version overrides.
