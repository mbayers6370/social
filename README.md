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

Social posts, messages, uploads, friendships, preferences, and drafts are local previews. Most state, including unsent message drafts, survives navigation within the tab and resets on refresh. Messages added to the preview reset when leaving Messages. Uploaded photographs stay in browser memory and are never sent to a server.

On Repeat supports live Apple catalogue search and optional local PostgreSQL persistence. See [local music setup](docs/music-search.md).

Production serves the public website and excludes development accounts and routes. Registration is closed. Public legal pages are drafts; the legal operator and working support address must be supplied before launch.

## Optional services

Copy `.env.example` to `.env` and configure only the services you use. Real environment files are ignored; commit placeholder examples only.

For phone testing, set `MARGIN_DEV_ALLOWED_HOSTS` to exact hostnames in your ignored `.env`. Keep personal network addresses out of source control. Production does not include these development origins.

- **Clerk:** authentication keys and the canonical app origin. Configure domains, redirects, and account policy in Clerk.
- **PostgreSQL:** `DATABASE_URL` for Prisma. Review migrations before running `npm run db:migrate` against the intended development database.
- **Cloudflare R2:** private bucket and scoped credentials. Production user-media upload/delivery is not implemented.
- **Upstash Redis:** REST endpoint and token for server rate limits.
- **Sentry:** DSN and project settings; use an upload token only in trusted build environments.

Prisma scripts load `.env` explicitly. The optional local database command uses its own isolated cluster; see the music guide. No cloud provisioning or remote migrations run automatically.

## Checks

Before pushing, use the same verification command as CI:

```sh
npm run test:e2e:install
npm run hooks:install
npm run verify
```

Install the browser and repository hook once per clone. The pre-push hook runs verification automatically and stops a push on failure. Commit or stash changes first: it checks a clean working tree against the commit being pushed. It does not commit or push for you.

Verification uses an ignored temporary copy under `.local/` so an open development server can keep running. It excludes real environment files, disables live integrations, and runs formatting, types, lint, styles, unit tests, the production build, desktop/mobile browser tests in development and production, and both dependency audits. Development tests use a fixed server/browser clock. Failed runs retain local reports at the printed path; successful copies are removed.

Use `npm run verify -- --code-only` for formatting, types, lint, styles, unit tests, build and dependency audits without launching browsers. The pre-push hook runs the full suite by default. For an explicitly code-only local push, use `MARGIN_VERIFY_CODE_ONLY=1 git push`; the clean-tree and commit checks remain active, and CI still runs the full browser suites.

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
- [Styles](src/styles/README.md): CSS ownership, tokens, and interface conventions.
- [Brand assets](src/assets/brand/README.md): original artwork and shared branding components.
- `src/app/`: routes and layouts.
- `src/features/`: feature components and client-safe schemas.
- `src/components/`: shared components and layout.
- `src/server/`: server-only integrations, authorization, and fixtures.
- `prisma/`: database schema and migrations.
- `tests/`: unit, integration, and browser test source.

## Production boundaries

The social application is a development preview. Authenticated social writes, persistent friendships and messages, private user-media delivery, moderation, and scheduled expiration/deletion remain incomplete. Music persistence currently uses a development-only actor and local database; it is not production account storage. Real exports and account deletion are unavailable.

Do not expose the development server publicly. Production launch requires server-derived identity, resource authorization, transactional posting allowances, durable storage, configured service accounts, and live integration verification. Dependency versions belong in `package-lock.json`; use normal audited upgrades rather than forced major-version overrides.
