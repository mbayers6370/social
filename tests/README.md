# Testing Margin

Run commands with the Node version in `.nvmrc`. Reports, traces, credentials,
database state and screenshots stay ignored; test source and fixtures are versioned.

| Level        | Command                                           | Purpose                                                                                                                                                                    |
| ------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fast         | `npm run check`                                   | Formatting, types, lint, stylesheet ownership and credential-free unit/component tests                                                                                     |
| Focused fast | `npm run check -- tests/private-profile.test.tsx` | The same static checks with relevant test files                                                                                                                            |
| Full         | `npm run verify`                                  | All fast checks, real isolated PostgreSQL integration, production build, essential desktop/mobile browser regressions in development and production, and dependency audits |
| Extended     | `npm run verify:extended`                         | Full verification plus presentation exploration and Firefox/WebKit journeys                                                                                                |
| Inventory    | `npm run test:inventory`                          | Collect every case and the browser execution matrix without running test bodies                                                                                            |

Full verification remains mandatory in `.githooks/pre-push` and GitHub Actions.
`--code-only` is a diagnostic convenience and cannot satisfy that gate. The hook
checks the commit and working tree again after verification. A green result is
not reused for another commit.

Install Chromium with `npm run test:e2e:install`. Before a local extended run,
also run `npx playwright install firefox webkit` (Linux hosts need Playwright's
`--with-deps` option). CI installs the additional engines only for extended runs.
Production browser checks also require OpenSSL. A loopback-only TLS proxy creates
one-day certificates in a private temporary directory and removes them on shutdown.
Only this managed test certificate bypasses browser trust validation; application
CSP, HSTS and response headers remain intact.

## Test ownership

- **Unit and server contracts:** `tests/*.test.ts`, Vitest project `unit`.
  Pure models, parsers and mocked provider/HTTP boundaries run in Node, without jsdom.
- **Components:** `tests/*.test.tsx`, project `component`. Testing Library checks
  visible behavior, keyboard controls, recovery and focus. React unmounts before
  a test restores browser stubs. Real browser geometry belongs in Playwright.
- **PostgreSQL integration:** nine `*-db.integration.test.ts` files, project
  `database`. `npm run test:social-db` creates and migrates one disposable
  loopback database, grants the restricted runtime role, runs suites serially,
  then drops it. Intentional concurrency stays inside the individual tests.
  The shared URL guard rejects application databases and privileged identities.
- **Browsers:** `tests/e2e/*.spec.ts`. Role/name locators identify controls;
  semantic data attributes and geometry selectors are retained where layout is
  the behavior under test. Every test gets a fresh context; Playwright reuses
  the browser process within each worker, never a shared signed-in context.
- **Real services:** project `live`, the guarded `test:*:live` commands, and
  the explicitly opted-in local music database test. These are separate from
  ordinary verification and require their own disposable identities and service
  configuration. Their results must not be described as ordinary fixture evidence.

Authentication, authorization, invitations, media, messaging and retention have
complementary layers. Component mocks do not replace the real database tests.
See [the audit](AUDIT.md) for the coverage matrix and consolidation record.

## Determinism and failure evidence

The verification runner copies sources into a credential-free `.local/verify-*`
workspace, leaving the open development server alone. It clears ambient live-test
flags, provider keys and remote browser URLs, and allocates an independent local
port. Unit/component tests reject forgotten `fetch` doubles immediately. Browser
fixtures intercept external art and link destinations; unhandled provider API
traffic fails the test instead of accessing a live service.

The managed development browser and server share `fixture-time.json`; attached
local servers keep their own clock. Provider fixtures remain fictional. No test
helper grants an actual authenticated identity to the production application.

Each verification run writes `.local/verification/run-*/summary.json`, unit and
database JSON results, and browser result JSON. Browser reports and output have
separate development/production directories so a later stage cannot erase an
earlier failure. Failures retain a screenshot and trace automatically. Optional
success images can be captured with `PLAYWRIGHT_CAPTURE=1 npm run verify:extended`;
they are diagnostic evidence, not pixel-comparison baselines.

Tests tagged `@extended` and the presentation files in `e2e/suites.ts` remain
available in extended verification. Pure font/icon specimens run there once,
not again against a production server they do not use. Mobile-only files are
scheduled once in the mobile context. Production only collects files with
production-compatible routes. Conditional skips within mixed files are labelled.

CI permits one retry for diagnosis and rejects flaky passes. Superseded runs of
the same workflow event are cancelled; push and pull-request checks remain
independent because they may test different merge trees. Manual workflow dispatch
can select the extended level. Live-provider checks are never enabled by CI flags.
