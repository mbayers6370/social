# Test infrastructure audit — 4 November 2026

Scope: test source, fixtures, runners, documentation and CI. No application
functionality, design, schema or authorization policy changes are part of this work.

## Inventory

Counts distinguish authored scenarios from execution across browser projects.
Security coverage overlaps these categories; it is not counted twice.

| Category                            | Original files / cases | Final files / cases |
| ----------------------------------- | ---------------------: | ------------------: |
| Unit/model and server contract      |               31 / 214 |            32 / 219 |
| Component                           |               64 / 350 |            65 / 351 |
| Real disposable PostgreSQL          |                9 / 160 |             9 / 160 |
| Explicit opt-in service/local-music |                  2 / 4 |               2 / 4 |
| Playwright authored journeys        |               53 / 173 |            53 / 172 |

The original ordinary Vitest command collected 728 cases and skipped 164 database
and opt-in cases. Ordinary tests now run only the unit/component projects; real
database tests remain mandatory in full verification and service checks stay explicit.

Two additional guarded provider CLI programs, `scripts/test-auth-live.mjs` and
`scripts/test-invitations-live.mjs`, remain unchanged. Their multi-stage checks are
not counted as Vitest cases. They require a separately configured local app and
test-mode services and were intentionally not executed by this credential-free audit.

`npm run test:inventory` writes the complete per-file/per-case inventory and full,
production and extended browser matrices under `.local/test-inventory/`. This is
generated evidence rather than a second manually maintained list of all tests.

The final standard browser matrix schedules 317 development and 60 production
executions, versus 348 in each original pass. The extended development matrix
schedules 377 executions, including the retained presentation cases and additional
Firefox/WebKit journeys. The net authored-browser reduction is one: two redundant
scenarios consolidated and one existing long journey split for isolation.

## Timing evidence

The original full runner was executed. It stopped after two development browser
failures; its production and audit stages were then run separately against the
same original snapshot. Production exposed one additional unstable resize check.
Both full measurements used Node 22 and two browser workers on the same local
machine, with fresh isolated builds. This is a single local before/after sample,
not a statistical benchmark. Baseline failures, compiler/OS caches and registry
response times affect the comparison; the measured 58.09s reduction is not a
controlled claim that every future run will be 11% faster.

| Phase                                                 | Original seconds | Final seconds |
| ----------------------------------------------------- | ---------------: | ------------: |
| Disposable PostgreSQL                                 |            18.90 |         17.30 |
| Formatting                                            |             8.21 |          8.86 |
| TypeScript                                            |            11.89 |         11.80 |
| Lint                                                  |            24.49 |         15.41 |
| Stylesheet checks                                     |             0.30 |          0.31 |
| Unit/component                                        |            19.64 |         20.64 |
| Production build                                      |            32.48 |         34.82 |
| Development browsers                                  |           367.90 |        339.82 |
| Production browsers                                   |            35.65 |         17.59 |
| Dependency audits                                     |             8.62 |          3.40 |
| Total, including separately completed original stages |           528.33 |        470.24 |

The slowest original browser files by summed test duration were `feed.spec.ts`
(126.25s), `account-entry.spec.ts` (45.30s, including a failure),
`card-actions.spec.ts` (44.76s, including a timeout), `screens.spec.ts` (32.17s)
and `public-pages.spec.ts` (31.25s). Summed case time overlaps across workers;
it must not be added to wall time.

## Consolidation and rewrites

- Merged the saved-photo selection scenario from `ui-refinements.spec.ts` into
  the existing profile-photo journey in `account-flows.spec.ts`. Disabled submit,
  deliberate selection, selection styling, absence of a text field and the
  confirmation dialog remain covered; component selection/cancellation tests remain.
- Merged its separate public sign-in border/narrow-screen scenario into
  `account-entry.spec.ts`, which already visits the same page at 320px. Both
  membership navigation and accessible sign-in remain exercised.
- No authentication, authorization, invitation, database, private-media,
  messaging, rollback or rate-limit scenario was removed or replaced by a mock.
- Extracted one restricted disposable-database URL guard for all nine integration
  files. Real PostgreSQL and the existing in-test concurrency remain unchanged.
- Split Next static-image loader doubles from DOM setup, and centralized cleanup
  ordering. Node tests no longer load jsdom or Testing Library setup unnecessarily.
- Made 117 unconditional success screenshots opt-in. These were evidence captures,
  not image comparisons. Automatic failure screenshots/traces remain enabled.
- Replaced file-upload CSS selectors and the membership CTA selector with labels
  or accessible links. Geometry selectors remain where geometry is the assertion.
- Moved presentation-only explorations to the extended matrix, removed duplicate
  desktop scheduling of mobile-only files, and stopped collecting development-only
  files for production. All retained authored journeys remain available.
- Membership navigation now waits for its actual URL transition, and responsive
  overflow checks wait for the invariant after a resize rather than inspecting an
  intermediate layout. No larger tolerance, retry-to-green policy or CSS change
  was introduced for these failures.
- The conversation utility journey dismisses the options popover before clicking
  the separate retention/export control, which it covers on narrow screens.
- No unused fixture/helper or obsolete snapshot file was found to justify deletion.
  Provider doubles and mocked Next imports are labelled boundaries, not evidence
  of a hosted provider session or real external delivery.
- Extended execution exposed a pre-hydration mobile Back click, Safari's distinct
  default link-navigation shortcut, and missing file bytes in WebKit request
  interception. The hard-load test now waits for the thread's real focus effect;
  WebKit uses [Safari's Option-Tab shortcut](https://help.apple.com/safari/mac/8.0/en.lproj/cpsh003.html).
  Recovery tests check actual fetch `File` size and SHA-256 in every engine and
  retain encoded-multipart digest checks in Chromium/Firefox. This avoids
  [WebKit's documented interception limitation](https://github.com/microsoft/playwright/blob/main/tests/page/page-request-intercept.spec.ts)
  and enormous binary diffs without changing payloads or application behavior.
  All 14 focused cross-project checks pass, with no retries.

## Safeguards and gaps

| Risk                                                         | Preserved evidence                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, revocation, account lifecycle                      | `auth.test`, protected/account session components, `auth-db.integration`, browser authentication and production fail-closed checks            |
| Friendship, blocking, Space permissions                      | social/member/communication/Space-invitation PostgreSQL matrices and HTTP contracts                                                           |
| Invitation slots, concurrent claims, retry and rollback      | auth and invitation-link PostgreSQL integration                                                                                               |
| Private media and database integrity                         | actual runtime-role database tests, local object-store integration, foreign-owner denial, reference rollback, production optimizer boundaries |
| Messaging participants, consent, retained history and expiry | member/communication/retention PostgreSQL tests, messaging UI and API contracts                                                               |
| Abuse limits and failures                                    | rate-limit contract tests, fail-closed HTTP/session/database cases; real distributed Redis remains explicit opt-in                            |

New infrastructure regressions cover ambient credential/live-flag leakage,
accidental provider network access, unsafe database URLs and identities, and files
or HEAD changing during the full pre-push check. Six cases were added. The shared
component teardown order addresses the observed `matchMedia` cleanup race.
Vitest reads hook sequencing from the root configuration, not individual projects.
A new browser-subscriber teardown regression fails with the former stack order and
passes with the corrected root setting; the focused 19-case run also passes.

## GitHub failure reconciliation

Reviewed the failed push/PR pairs since the branch's preceding successful checks:

| Runs                                                                                                                                                         | Failure                                                                              | Current disposition                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [41803245896](https://github.com/mbayers6370/social/actions/runs/41803245896), [41803252199](https://github.com/mbayers6370/social/actions/runs/41803252199) | Two desktop profile-composer centering assertions; the PR also retried account entry | Replaced the scroll-locked `clientWidth` reference with the actual root bounding box, preserving the 0.5px tolerance. Both composer journeys now also run with visible scrollbars. Split fictional onboarding from the multi-route public journey and explicitly await its navigation, avoiding a shared cold-compilation timeout. |
| [41795608879](https://github.com/mbayers6370/social/actions/runs/41795608879), [41795882153](https://github.com/mbayers6370/social/actions/runs/41795882153) | Notification teardown and 22 browser failures against changed product behavior       | Earlier branch fixes already updated the stale friendship, upload, feed, image and conversation expectations. Shared component cleanup now unmounts React before restoring browser stubs. The composer geometry issue remained and is addressed above.                                                                             |
| [41621441135](https://github.com/mbayers6370/social/actions/runs/41621441135), [41621554647](https://github.com/mbayers6370/social/actions/runs/41621554647) | Missing Ticketmaster fixture import in database tests                                | Already fixed before this audit; the fixture is tracked and the actual PostgreSQL suite passes.                                                                                                                                                                                                                                    |

No historical run is relabelled green. Remote CI needs a new commit and run;
local verification results below are evidence for the working tree only.

## Validation and intentional exclusions

`CI=true npm run verify` passed in 7m50.24s, with no retries or flaky cases:
570 unit/component cases, 160 PostgreSQL cases, 306 development browser checks
and 36 production browser checks. The final summary and case-level JSON are in
`.local/verification/run-z8Cb85/`; future CI uploads equivalent evidence for 14 days.

The 11 development browser skips are explicit viewport or production-only branches:
eight desktop/mobile-specific cases, two production-boundary cases and one desktop
file-drop case. The 24 production skips are development-only branches in mixed
files: two profile-setup, two feed/account, six authentication, two workbench and
twelve invitation-fixture cases. These fixture behaviors run in development;
the actual production denial/boundary cases run in production. The four service/
local-music Vitest cases and two guarded provider CLI programs remain explicit opt-in.

The CI timeout is now 45 minutes, versus the longest reviewed recent GitHub job's
15m18.63s (including installation and cleanup). The standard full gate and job name
remain unchanged. Existing moderate dependency advisories are reported; both
existing high-severity audit gates pass.

The recorded full timing precedes the final cross-browser harness corrections.
Extended validation completed in stages: the latest complete development pass
passed all 364 active checks in 293.90s; its HTTP production pass exposed WebKit's
HTTPS upgrades under the real production CSP. A test-only loopback TLS proxy now
serves the unmodified production build. All 56 active production checks then
passed in 27.47s, followed by successful shutdown/certificate-cleanup checks and
both dependency audits. The failed intermediate workflow summary is retained,
not relabelled green. Completion logs are `.local/test-audit/final-production-tls.log`
and `.local/test-audit/final-tls-cleanup.log`; the development case JSON is under
`.local/verification/run-IYrpha/`. The staged completion manifest is
`.local/test-audit/staged-completion.json`.

Extended skips are 13 development cases (the standard 11 plus two production-only
branches in Firefox/WebKit) and 32 production cases (the standard 24 plus eight
development-fixture branches in Firefox/WebKit). No additional live-service case
was enabled. All 420 active extended browser checks passed; no critical case was
skipped to resolve a failure.

The focused fast command passed all static checks and 11 selected infrastructure
regressions in 47.73s; its summary is `.local/verification/run-Am3kKJ/`.

## Remaining opportunities

- Split the large feed browser file by reading, discussion and viewport journeys;
  first preserve its scroll/focus and mobile interaction matrix explicitly.
- Consider a stable, locked, content-addressed verification workspace for compiler
  caching. Fresh isolated workspaces are retained now to avoid stale-build evidence
  or interference with the user's app.
- Browser backend fixtures still do not establish actual hosted Clerk revocation,
  Redis distribution, email delivery or production object-store configuration.
  Those checks remain explicit extended/release work with dedicated credentials.
- Dependency audits retain the existing high-severity gate; baseline moderate
  advisories are not silently remediated through production dependency changes.
