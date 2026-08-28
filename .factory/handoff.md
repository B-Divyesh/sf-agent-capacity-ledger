# Agent Capacity Ledger repair handoff

Repair work order: `agent-capacity-ledger-repair-2`

Base verifier report: `79ecb10228a86097084f8833835af398713bbb2f`

Repaired product commit: `773dca2c5709e621339febfbe79e545de55e0def`

Artifact/deployment class: unchanged — Rust/axum backend serving the Vite/Svelte frontend from one container.

## Release repair

- Replaced production replica-local SQLite persistence with a shared PostgreSQL path selected by `DATABASE_URL`. The normal container runtime uses a least-privilege database credential; `DATABASE_MIGRATE=1` is only the explicit migration path. Local no-env startup still safely uses SQLite at `/data`.
- Created the product-specific `agent_capacity_ledgers` table with the factory migration credential, then configured the Container App's `DATABASE_URL` as its `ledger-db` secret. The app itself has no database secret in source or image.
- Reproduced the former replica failure against independent app processes, then verified the repair against the real shared database: save in one process/read in another, terminate and restart the reader, then read the same workspace successfully.
- Live scale-out evidence: temporarily scaled the deployed revision to three replicas, saved `Scaled durable proof`, then received that record on **120/120** independently forwarded reads. An offline browser edit saved after reconnect and appeared in a fresh browser workspace link. After a live revision restart, `Offline scale source` appeared on **30/30** reads. Scale was restored to the work-order setting, `minReplicas: 1`, `maxReplicas: 3`.
- CSV import now parses RFC 4180 quoted cells, including `"Anthropic, Inc"`; calendar validation now rejects impossible dates such as `2026-02-30` in both demo and real source validation.
- Every visible mobile interaction is at least 44 by 44 CSS pixels, including the demo exit link, source-row actions, wordmark, and footer links. The 404 page now says plainly that the page was not found.
- The $9 monthly team-plan copy is accurate and honest: checkout is unavailable, no purchase link is rendered, and existing licenses can still be restored and verified. Removed unprovable checkout/receipt/refund claims.
- Completed the claim inventory for current public copy and made the cold claim runner build the backend before Playwright starts its web server, avoiding the prior 120-second web-server startup timeout.

## Verification

From a clean dependency install on 2026-08-28:

```sh
npm ci
npm run check
npm test
cargo clippy --all-targets -- -D warnings
npm run build
cargo build --release
npm run test:e2e
./verify-url.sh http://127.0.0.1:4180
```

- `npm ci`: 139 packages; audit reported 0 vulnerabilities.
- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 7 Vitest tests and 6 Rust tests passed. Rust regression `shared_database_survives_replica_and_restart_reads` opens independent app instances against one durable database file.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `npm run build`: passed; JS 73.00 KB raw / 26.89 KB gzip and CSS 16.75 KB raw / 4.57 KB gzip.
- `cargo build --release`: passed.
- `npm run test:e2e`: **30/30 passed**, including all 16 exact `@claim:` tests, quoted CSV, impossible date, mobile target sizing, keyboard dialog behavior, axe serious/critical checks, privacy, offline queue, sharing, and response policy.
- `verify-url.sh` passed locally and live: title, language, main/h1 counts, image alternatives, 390 px overflow, console errors, and page errors were all clean. The standalone `@axe-core/cli` could not launch its Selenium Chrome binary in this image; the shipped Playwright Axe suite ran successfully instead.
- Live URL: <https://agent-capacity-ledger.sociobot.in>. `/health` returned the repaired commit SHA above. The container runs non-root, accepts default `PORT`, and retains the work-order scale configuration after the scale-out proof.

## Remaining product limits

- Workspace links are bearer links. Anyone with a link can read and edit that workspace; add organization authentication before a larger rollout.
- The $9 team plan is intentionally not purchasable until the factory enables the Sociobot billing product. No unavailable checkout is presented.
