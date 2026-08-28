# Agent Capacity Ledger v1 handoff

## What was built

- A production Svelte 5 interface with `/`, `/demo`, `/ledger`, `/privacy`, `/terms`, and styled 404 routes.
- A Rust 2021 axum service that serves the built app and persists real workspaces in SQLite.
- Capacity sources with limits, use, reset dates, daily pace, estimated runout warnings, notes, costs, edits, and removal undo.
- Approved fallback selection between recorded sources.
- Project spend entry, attribution percentage, CSV import, and complete CSV export.
- Private workspace links so a small team can open the same server-backed ledger.
- An isolated one-click demo with three sources, fallback policy, project costs, reset, and a persistent demo banner.
- Offline-aware local caching for the real ledger. Queued browser changes save after reconnection.
- A $79/team/month tier with hosted Sociobot checkout, returned-license capture, daily verification caching, and license restore.
- Original “midnight capacity observatory” art, generated for this product and shipped as 23–67 KB WebP assets.
- Route metadata, social art, sitemap, robots file, CSP, security headers, keyboard focus handling, reduced motion, mobile records, and clear error/empty states.

## How to run

```sh
npm install
npm run build
PORT=8080 DATA_DIR=./data cargo run
```

Open `http://localhost:8080/demo` for the verification sandbox.

## Verification completed

- `npm run check`: passed with 0 errors and 0 warnings.
- `npm test`: passed 4 Vitest tests and 2 Rust route tests.
- `npm run test:e2e`: passed 17 Playwright tests, including every `.factory/claims.json` claim, 390 px layout, metadata, axe, and console checks.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo build --release`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Production output: `dist/index.html`; 70.2 KB JavaScript raw / 26.0 KB gzip; 16.6 KB CSS raw / 4.5 KB gzip; largest hero derivative 67 KB.
- Lighthouse mobile on the production server: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.4 s, CLS 0, TBT 50 ms.
- Load smoke: 100 concurrent `/health` requests returned 100 HTTP 200 responses.
- Generated image reviewed for text artifacts, brands, people, seams, and misleading UI; none found.

## Runtime and deployment notes

- `PORT` defaults to 8080. `DATA_DIR` defaults to `/data`. No other variable is required.
- `/health` is rate-limit exempt and returns `BUILD_SHA` or `dev`.
- All `/api` routes use a 40-request burst, replenish at 20 requests per second, and key the first forwarded IP.
- The Dockerfile is multi-stage, does not read `.git`, accepts `ARG BUILD_SHA=dev`, and runs as a non-root user.
- The worker image did not contain a Docker CLI, so a local `docker build` could not be run. Both Docker build stages were verified separately with `npm run build` and `cargo build --release`.

## Known gaps and next steps

- Workspace links are bearer capabilities. Anyone with the link can edit that ledger. Add organization sign-in and membership roles before larger pilots.
- CSV parsing accepts comma-separated plain fields and does not yet handle quoted commas.
- Forecasts rely on user-entered vendor readings because vendor APIs do not offer one stable cross-provider format.
- The factory still needs to register the paid product and exercise a real checkout in its release environment.
