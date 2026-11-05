# Upstash usage and interaction refresh

Audited November 5, 2026. No quota, billing plan, production credentials, rate-limit allowance or security timeout behavior was changed.

## What the dashboard shows

The `margin-development` dashboard showed about 160K of 500K monthly commands: about 1.5K Monday, 44K Tuesday, 44K Wednesday and 70K Thursday at observation time. These are cumulative database-wide commands, not HTTP requests, users, or an instantaneous idle rate. Values are rounded and provider daily buckets use UTC. The dominant GET / INCRBY / EVALSHA / PEXPIRE mix matches the installed single-region sliding-window limiter, but does not identify every originating environment retrospectively. EXISTS was also visible; console checks can contribute commands.

Upstash counts commands inside Lua scripts. The installed limiter performs EVALSHA plus two GETs and an INCRBY for an allowed check, with PEXPIRE when a bucket is first created. Normal allowed checks therefore cost 4–5 commands before retries, cache misses, other features or replicas. One authenticated feature request normally checks authSession and its route policy, so it can produce 8–10 commands. This is a code-derived model, not a replacement for measured command counts. Analytics is already disabled; blocked-identifier caching is already enabled by the SDK. Pipelining would reduce network trips, not necessarily billable commands.

## Environment and workflow inventory

| Environment / workflow                                  | Connects to Upstash?                       | Evidence and boundary                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-in local development (desktop and iOS Simulator) | Yes                                        | The root .env has both Redis settings; the running localhost app uses getRedis via enforceRateLimit. Authentication, reads, media, mutations, invites and external-search budgets can call it.                            |
| Local production review                                 | Yes, with the configured local credentials | The guarded review loads local configuration. It is a real-account runtime, not an isolated test. It must not share future production credentials.                                                                        |
| Hosted npm start / deployed application                 | When configured                            | Uses its host environment. Local source cannot certify what live host variables are set or attribute historical traffic to an undeclared deployment. Verify hosting separately and use a dedicated production database.   |
| npm run verify / npm run check and ordinary CI          | No live Upstash access                     | isolatedEnvironment strips UPSTASH variables and opt-in flags. Unit/component and DB-boundary tests use doubles; browser verification gets credential-free configuration. The GitHub workflow injects no Redis secret.    |
| Explicit live auth/Redis/invitation tests               | Yes                                        | test:auth:live, test:auth-redis:live and test:invitations:live opt in and use configured development Redis. They are not part of standard CI.                                                                             |
| Public health probe                                     | No                                         | /api/health is a liveness response, not a session or Redis check.                                                                                                                                                         |
| Maintenance worker and application builds               | No normal idle Redis loop                  | Current maintenance uses DB/storage/provider services directly. Builds do not run authenticated user traffic. Redis has no application cache/queue consumer here; getRedis's application caller is the rate-limit module. |
| Upstash console / audit observer / other clients        | Can contribute                             | Console inspection and any other process using the same endpoint are outside browser request counts. The audit uses read-only monitoring and discards raw keys and identities.                                            |

All current rate-limit keys share social:ratelimit:<policy>. That prefix identifies a policy, not an environment. Do not claim precise historical development-versus-hosting attribution from the dashboard alone. Separate development/production databases before deployment; adding namespaces to a shared quota is not cost isolation. Do not rotate/reset counters or switch databases during active protection merely to make usage look smaller.

## Idle measurement

The warm-up revealed an iOS Simulator browser still running an older client, plus an existing Help window. The Simulator showed the retired Event Spaces UI, confirming stale source rather than a new timer in the updated component. Those pages were reloaded without signing out; the Simulator returned to its existing Spaces account. Partial warm-up samples were discarded before the clean after-sample. The baseline includes the existing desktop/mobile clients; this is not a single-tab benchmark. Signed-in public Help also mounts member navigation and can contribute notification calls.

Both settled samples lasted 600 seconds (before 600.216 s; after 600.196 s), on November 5, 2026, America/Los_Angeles. Before: 11:52:39 AM PST–12:02:39 PM PST. After: 12:11:23 PM PST–12:21:23 PM PST. Application source and browser interaction were held steady inside each clean sample.

| Observation                                        | Before | After |
| -------------------------------------------------- | -----: | ----: |
| Message/conversation HTTP requests                 |     72 |     0 |
| Notification HTTP requests                         |     59 |     0 |
| Session-security HTTP requests (/api/auth/session) |     20 |    30 |
| Other API/page requests                            |      0 |     0 |
| Total local application HTTP requests              |    151 |    30 |
| Observed Redis commands, shared database stream    |   1164 |   140 |

| Redis command | Before | After |
| ------------- | -----: | ----: |
| EVALSHA       |    281 |    30 |
| GET           |    562 |    60 |
| INCRBY        |    281 |    30 |
| PEXPIRE       |     40 |    20 |

Redis prefix totals: before, read=544 and authSession=620; after, authSession=140 and read=0. No unprefixed commands or unparsed monitor events were observed in either clean sample. This does not prove that another client did not use those same prefixes.

The observed HTTP total fell by 80.1%; the observed Redis stream count fell by 88.0%. These are comparisons of the two windows, not exclusive causal attribution, a provider billing reconciliation, or a promised monthly reduction. The session-probe count changed from 20 to 30 across the existing desktop/mobile contexts after stale clients were reloaded. We report that difference without normalizing it away or inferring an exact cause from aggregates. The security monitor source/schedule was not changed.

The HTTP observer runs at the development Proxy boundary and counts route categories only: messages, notifications, session-security, other API and pages. Framework static assets excluded by the Proxy matcher are not part of this counter; in a settled idle sample they should not recur. The observer does not inspect bodies, cookies, IPs or account identifiers.

The Redis observer uses the configured database's read-only MONITOR stream and counts emitted commands, including script-internal commands when emitted, plus known rate-limit policy prefixes. It does not retain raw commands, keys or user identifiers. These are observed stream counts, not a provider invoice or a guarantee that every cluster/client event is represented. The provider dashboard is database-wide and rounded; it is corroborating context, not an isolated test counter. Non-policy commands and other clients remain unassigned.

An authSession prefix is NOT synonymous with the minute-based browser session probe: normal feature requests also pass through that policy. The separate /api/auth/session HTTP category identifies the deliberately retained browser security checks. The read policy covers several routes; Redis read-policy commands cannot be divided exactly into message versus notification requests from a prefix alone.

## Resulting behavior and safety

- Messages, the conversation list, notifications and invitations no longer poll every 10/15/30 seconds. Opening a feature, returning to a visible window or a relevant local change triggers fresh reads. A one-shot invitation-expiry check remains; it is not a recurring poll.
- Member conversations have a small Refresh icon in the top-right header beside the conversation menu; Notebook has no refresh icon. It remains available without navigating away, disables during a request, preserves drafts and permits retry after failure. Incoming messages do not appear automatically while a user remains on the page.
- Non-security return events share an in-flight read and coalesce duplicate focus/visibility events within one return. A return during an older request queues one follow-up read after completion; repeated events share that follow-up. Explicit Refresh has no cooldown and never reuses a completed response. Switching conversation scopes aborts the old read.
- The session monitor remains: initial entry, visible focus/online/visibility changes and every visible minute. Provider sign-out/switches and failed checks still hide private content. Its in-flight suppression remains; no cross-request positive authorization cache was added.
- Every actual server request still verifies the current session/account and consumes the existing distributed route/auth budgets. Limits, subject keys, sliding-window algorithm, denial behavior and rejection of the SDK's permissive timeout are unchanged.

Keep an eye on the daily command slope after the change. An idle signed-in visible tab still intentionally generates security traffic; multiple windows/tabs add checks. At 4–5 commands per allowed authSession evaluation, a single minute-based probe is roughly 240–300 Redis commands per hour before focus events and other clients. This is a model; use the measured samples for observed traffic. Stop unused signed-in development tabs rather than disabling security protections. Review compatible provider limits and alerts before beta; no paid upgrade was made here.

## Server-push follow-up

The owner chose interaction refresh for now. A later authenticated SSE/WebSocket channel can notify a client when a message/notification changes, then the client can fetch only the affected data through the existing authorized APIs. The channel must handle session revocation, account switches, blocking, audience checks, reconnect/backoff and missed events. It must not broadcast private content or rely on one process's memory across scaled instances. Evaluate a shared PostgreSQL LISTEN/NOTIFY listener for commit-time invalidation before adding another paid service; do not replace browser polling with one DB poll per user. Keep manual refresh and re-fetch after reconnect. Transport and hosted connection limits need a separate design/verification step.

Sources: [Upstash rate-limit costs](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs), [SDK caching and timeout behavior](https://upstash.com/docs/redis/sdks/ratelimit-ts/features), [console-generated commands](https://upstash.com/docs/redis/troubleshooting/command_count_increases_unexpectedly), [Redis REST monitoring](https://upstash.com/docs/redis/features/restapi), [Render WebSockets](https://render.com/docs/websocket), [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.htm).
