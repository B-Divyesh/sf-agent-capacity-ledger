# Agent Capacity Ledger repair handoff

Repair work order: `agent-capacity-ledger-repair-1`

Base report: independent verification of candidate `d18808a22c11e8c9b2608874d8b8a6b026443abd` on 2026-08-28

Artifact/deployment class: unchanged — Rust/axum backend serving a Vite/Svelte frontend from one container

## Release-blocking findings repaired

- **Replica-safe request allowance:** the old 40-request governor existed separately in every autoscaled process. The work-order deployment allows three replicas, which multiplied the live allowance. Each replica now keys the first `X-Forwarded-For` address and allows a 10-request burst with five requests per second recovery. At the configured three-replica maximum this remains stricter than the former 40-burst/20-per-second product allowance. `/health` remains exempt. A Rust regression sends 60 requests across three independent app instances; a Playwright claim test checks `429` and `Retry-After`.
- **Complete source-removal undo:** source removal now records linked spend rows and incoming fallback relationships, clears invalid relations while removed, and restores the source, row order, linked spend, and fallbacks on Undo. The notice names the linked records removed.
- **Dialog keyboard containment:** source and spend dialogs now cycle Tab/Shift+Tab within the active dialog, close on Escape or backdrop/close controls, focus the first field on open, and return focus to the invoking control on every close path.
- **Real HTTP 404:** only the five SPA routes receive `index.html`. Unknown paths use the styled `404.html` with HTTP 404; unknown `/api` paths also return 404.
- **Complete claim contract:** `.factory/claims.json` now lists 16 observable claims, including CSV import, project attribution, the data boundary, license check caching, source caps, product policy boundaries, and hosted billing. A unit contract asserts exactly one `@claim:<id>` test per listed claim and rejects orphan tags.
- **Container contract:** the backend build stage now uses `rust:1-alpine`; the frontend stage uses `npm ci`. The build still accepts `BUILD_SHA`, does not read `.git`, and runs as a non-root runtime user.
- **Relational validation:** form, CSV, and server boundaries reject negative readings, non-positive limits, use above limit, invalid dates/costs, broken source relationships, duplicate IDs, and unknown JSON fields. Recovery errors are announced in the dialog. The typed server boundary also prevents arbitrary prompt, code, password, or key fields from being stored.
- **Immutable static caching:** `/assets/*` responses now send `Cache-Control: public, max-age=31536000, immutable` from the Rust server.
- **URL verifier:** executable `./verify-url.sh [url]` checks response success, title, language, one main and h1, image alt attributes, 390 px overflow, console errors, and page errors.

## Exact local verification

Run from a clean checkout:

```sh
npm ci
npm run check
npm test
cargo clippy --all-targets -- -D warnings
npm run build
cargo build --release
npm run test:e2e
./verify-url.sh http://127.0.0.1:8080
```

Evidence from 2026-08-28:

- `npm ci`: 139 packages installed from the lockfile; 0 vulnerabilities.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `npm run check`: 0 errors and 0 warnings.
- `npm test`: 6 Vitest tests and 5 Rust tests passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `npm run build`: produced `dist/`; JavaScript 72,610 bytes raw / 26,730 bytes gzip, CSS 16,630 bytes raw / 4,550 bytes gzip. Largest responsive hero asset: 68,206 bytes.
- `cargo build --release`: produced `target/release/agent-capacity-ledger`.
- `npm run test:e2e`: 28/28 passed in Chromium. Every one of the 16 exact `.factory/claims.json` commands was then run independently; each passed one matching test.
- Accessibility: Axe found zero serious or critical issues on `/`, `/demo`, `/ledger`, `/privacy`, `/terms`, and the open source dialog. Keyboard tests cover focus cycling, Escape, close button, backdrop, and focus return. The 390 × 844 test has 0 px overflow at normal size and at 200% root text size.
- Privacy/offline/update: the demo request log stayed same-origin; unknown sensitive fields were rejected and not stored; demo data stayed out of the real workspace; an offline edit remained local and saved through the API after reconnect.
- Response policy: a 60-request local burst returned 11 HTTP 200 and 49 HTTP 429 responses; all 49 limited responses had `Retry-After`. Unknown URL returned 404. Hashed JS returned immutable caching plus CSP, `nosniff`, referrer, and permissions headers.
- Runtime contract: the release binary started with only `PORT` and `PATH`; startup JSON logged supplied versus defaulted configuration. `/health` served 100/100 concurrent requests with HTTP 200 and graceful Ctrl+C shutdown completed.
- `./verify-url.sh http://127.0.0.1:4180`: correct title/lang/main/h1/alts, 0 px mobile overflow, 0 console errors, 0 page errors.
- Lighthouse 13 mobile/full audit: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.25 s, CLS 0, TBT 44 ms. The stricter performance preset scored 98 with LCP 1.95 s, CLS 0, and TBT 0.
- Desktop 1366 px and mobile 390 × 844 full-page demo screenshots were visually inspected; no clipping, overlap, or hidden action was found.
- Package/consumer checks do not apply to this web-with-backend artifact. The work-order ACR build is the container package check and is recorded below after deployment.

## Deployment and live identity

The repair is deployed with `/opt/fleet/lib/deploy-container.sh agent-capacity-ledger /work/repo Dockerfile 8080`. This section is updated after the committed image is live.

## Known gaps

- Workspace links remain bearer capabilities. Anyone with the link can edit that ledger; add organization sign-in and roles before larger pilots.
- CSV import intentionally supports simple comma-separated fields and does not parse quoted commas.
- Forecasts rely on user-entered vendor readings because vendors do not expose one stable cross-provider format.
- The factory still needs to register/exercise the paid product with a real checkout if that external catalog setup is not already complete.
- The deployment configuration supplies ephemeral container storage and no mounted volume. SQLite survives requests and reconnects within a running replica, but a revision replacement can discard workspaces. A durable factory-managed volume or PostgreSQL is the next infrastructure step; this repair does not alter factory infrastructure.
