# Public demo target

This is Margin’s default application: the welcome page, anonymous `/demo/` and four portfolio information pages. Run commands from the repository root. The main [README](../README.md) owns setup, hosting instructions and the comparison with the preserved full-stack capabilities.

| Command                                 | Purpose                                           |
| --------------------------------------- | ------------------------------------------------- |
| `npm run dev`                           | Hot-reloading welcome page and demo               |
| `npm run build` or `npm run demo:build` | Static export to `portfolio/out/`                 |
| `npm start` or `npm run demo:serve`     | Guarded local review of the current export        |
| `npm run demo:test`                     | Desktop/mobile journeys against the actual export |
| `npm run demo:test:dev`                 | Default development-entry checks                  |

Stop the existing demo server before an in-place build. Do not stop another developer’s running terminal to perform routine edits; use an isolated temporary verification snapshot when their server must stay available. Never put source snapshots under `.local/`.

`app/` owns only public entry points. Shared presentation comes from `src/features/`, `src/components/` and `src/styles/`; fictional content comes from `src/fixtures/`. There are no member/API routes or infrastructure imports. The build rejects backend dependencies and portfolio environment files, sanitizes service configuration, prepares an explicit asset allowlist and validates the export. `instrumentation-client.ts` installs the browser boundary before hydration.

The demo uses tab-local memory. Exit demo clears its providers and returns to welcome; refresh and restored browser history start fresh sample state. On Repeat uses bundled artwork and ordinary music links. Runtime catalogue requests, telemetry, private uploads, email delivery and production data are unavailable.

`public/`, `.next/` and `out/` are generated and ignored. Publish only `out/`. Its `_headers` targets Cloudflare Pages; Render requires equivalent host header configuration, including build-specific CSP hashes. The [deployment instructions](../README.md#deploy-the-static-demo) describe the remaining host checks. Building does not deploy or authorize service/DNS changes.
