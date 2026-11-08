# U.S. product access: Cloudflare → Render

This runbook belongs to the **preserved full-stack application**. The public portfolio demo does not use this Worker, country gate, Render Web Service, edge secret or backend origin. For the current Render **Static Site** and Cloudflare Pages options, use the [main deployment instructions](../../README.md#deploy-the-static-demo). Keep this architecture as engineering reference; do not apply it to the demo or change existing DNS/routes without separate approval.

The production gate permits only a trusted `US` connection country. It covers
sign-in/sign-up and their callbacks, invitations, onboarding, member/shareable
profile routes and private APIs. Exact public information pages, public assets
and the liveness probe remain accessible globally. `/api/webhooks/clerk` is also
exempt because its handler requires Clerk's signed webhook, not a visitor session.
The DAL rechecks the gate before verifying account sessions, including Server
Actions invoked through a public page. Development and the existing fully guarded
local production review remain usable without an edge credential.

## Deployment

1. Configure `margin.social` as the Render service's custom domain. Proxy its DNS
   through Cloudflare and use Full (strict) origin TLS. Keep the app's canonical
   `NEXT_PUBLIC_APP_URL=https://margin.social`; Clerk's required DNS records retain
   the settings prescribed by Clerk, separately from the app route.
2. Generate one random secret containing at least 32 bytes, encoded as base64url.
   Store it as `MARGIN_EDGE_SECRET` in Render's server environment and as a secret
   binding in the Cloudflare Worker. Never prefix it `NEXT_PUBLIC_`, commit it,
   log request headers, put it in a response, or grant it to a browser.
3. Deploy `region-edge.mjs` as a Cloudflare **route**, not a replacement origin,
   covering `margin.social/*`. Deploy without fail-open/pass-through-on-error.
   Route any additional product hostname through the same mechanism or redirect
   it to the canonical host. The Worker overwrites both internal headers from
   `request.cf.country` and the secret binding, ignoring supplied header values.
4. The Worker uses a manual redirect policy so the origin credential is never
   forwarded to a redirect destination. Configure Cloudflare not to cache HTML,
   RSC, sign-in, invitation or API responses; honor origin `private, no-store`.
   Do not enable a cache rule or Workers Cache that bypasses this check.
5. Requests to the Render hostname without this credential cannot access product
   routes, even with forged `CF-IPCountry`, `x-margin-country`, Host, locale or
   forwarded-IP headers. Restrict other origin ingress where hosting permits.
   Missing/invalid production configuration returns 503; missing edge trust,
   non-US, Tor and unknown countries return 403. No production disable flag exists.

Before inviting anyone, verify U.S. and non-U.S. connections, unknown-country
handling, direct Render-host access, forged headers, sign-in/callbacks, API and
Server Action denials, public privacy/help/contact access and actual signed
webhook delivery. Verify that response caching never shares a member response.
Changing only a visitor-supplied header is not a real geographical deployment test.

IP location estimates the apparent connection, not residency, nationality or
identity. Travel and inaccurate geolocation can cause denial; VPNs/proxies may
appear in a permitted country. No GPS permission or country history is collected
by this implementation. Do not enable city/latitude/longitude transforms for this
gate. Verify provider logs and privacy settings separately.

References: [Cloudflare request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/),
[header modification](https://developers.cloudflare.com/workers/examples/alter-headers/),
[cache interaction](https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/).
