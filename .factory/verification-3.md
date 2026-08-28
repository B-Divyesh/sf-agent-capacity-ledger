# Independent verification 3 — FAIL

Candidate: `14a5c3575fac020d80bd8548f37d976ec7db8ed8`

Live URL: <https://agent-capacity-ledger.sociobot.in>

Verified: 2026-08-28 UTC

Work order: `agent-capacity-ledger-verify-3`

## Release decision

**FAIL — do not release.** The live deployment serves the candidate, but real workspaces still use separate SQLite files on three unmounted replicas. A live offline edit displayed **Ledger saved**, yet 120 cache-busted reads returned the newest two-source ledger 42 times, the previous one-source ledger 39 times, and an empty ledger 39 times. Azure confirms that the active three-replica revision has only `PORT`; it has no `DATABASE_URL`, secret, volume, or mount.

This is fresh reproduction of the previously reported deployment-only failure. The repaired code can use PostgreSQL, but the candidate deployment does not configure it.

The candidate also changes the acceptance-contract price from **$79/team/month** to an unavailable **$9/month** plan, mislabels zero remaining capacity as **On track** when pace is zero, and leaves an invalid returned license stuck at **Checking it now**.

Evidence is in [`.factory/verification-artifacts/verify-3`](verification-artifacts/verify-3/).

## Mandatory claims-first and first-read gates

`.factory/claims.json` exists with 16 unique claims and one matching tagged test per claim. The dependency-free checkout was installed with the locked dependencies using `npm ci`, then every exact claim command was run independently; all 16 passed.

| Claim | Exact local test | Independent live result |
| --- | --- | --- |
| `capacity-forecast` | PASS | PASS for sample; FAIL for zero-capacity boundary |
| `csv-export` | PASS | PASS, header plus seven sample rows |
| `csv-import` | PASS | PASS, including an RFC 4180 quoted comma |
| `project-spend` | PASS | PASS |
| `demo-isolation` | PASS | PASS |
| `prompt-privacy` | PASS | PASS; demo made four same-origin requests only |
| `data-boundary` | PASS | PASS; sensitive extra field returned 422 |
| `server-persistence` | PASS locally | **FAIL live across replicas** |
| `workspace-sharing` | PASS locally | **FAIL live across replicas** |
| `offline-queue` | PASS locally | **FAIL live across replicas after “Ledger saved”** |
| `rate-limit` | PASS | PASS; allowance 10, then 50/60 were 429 with `Retry-After` |
| `paid-license` | PASS with recorded valid response | Invalid live response leaves stale progress copy |
| `license-daily-cache` | PASS | PASS in recorded-response test |
| `source-cap` | PASS | PASS in recorded-license test |
| `policy-boundary` | PASS | PASS; live model-proxy route is 404 |
| `team-plan-availability` | PASS | Accurate unavailability copy, but price and monetization violate the brief |

Per the claims contract, the three live claim failures are release-blocking even though the single-process/local test harness passes.

### Cold first-read test

**PASS on desktop and 390 px mobile.** Without prior cookies or storage, the first screen says:

- What it does: “Plan agent capacity before limits stop work.”
- Who it serves: small engineering teams juggling coding subscriptions, project spend, and approved backup tools.
- What to click: **Try it with sample data**, followed by “See a filled team ledger next.”

One click opens a populated ledger with three sources and four spend rows. The persistent banner says **Demo — sample data, nothing is saved** and exposes **Reset demo** and **Start for real**. Screenshots: [`live-first-read-desktop.png`](verification-artifacts/verify-3/live-first-read-desktop.png), [`live-first-read-mobile.png`](verification-artifacts/verify-3/live-first-read-mobile.png), and [`live-demo-mobile.png`](verification-artifacts/verify-3/live-demo-mobile.png).

## Defects

### Critical

1. **Saved ledgers are split across three replica-local databases and can appear lost.**

   - The active Azure revision has three replicas, `minReplicas: 1`, `maxReplicas: 3`, only `PORT=8080`, no secrets, no volumes, and no volume mounts.
   - Without `DATABASE_URL`, `src/main.rs` selects `/data/ledger.db`. That path is local to each unmounted replica.
   - A browser saved a normal source, went offline, added another source, reconnected, and received **Ledger saved**.
   - The first independent API read did not contain the offline source. A cache-busted 120-read probe then returned three states: 42 newest, 39 previous, and 39 empty. Unique URLs and absent `Age`/cache headers rule out a shared intermediary cache.
   - A fresh workspace link can therefore open old or empty data. `loadRealLedger()` then writes that response into the browser cache, compounding apparent data loss.
   - Evidence: [`live-persistence-reprobe.json`](verification-artifacts/verify-3/live-persistence-reprobe.json), [`deployment-config.json`](verification-artifacts/verify-3/deployment-config.json), and [`deployment-revisions.json`](verification-artifacts/verify-3/deployment-revisions.json).

### High

1. **Pricing and paid availability do not meet the researched brief.** The supplied brief and repository `.factory/brief.json` specify **$79/team/month**. The landing page, ledger, README, Terms, copy audit, and claims instead advertise **$9/month**, and explicitly state that checkout is unavailable. There is no explained acceptance-contract deviation, and the subscription path cannot run end to end.

2. **An exhausted source can be reported as healthy.** A valid boundary source with `limit=10`, `used=10`, and `daily pace=0` displays **On track**, “0 of 10 sessions left,” and “lasts about ∞ days.” The core forecast treats zero pace as infinite runway without first checking zero remaining capacity. This can conceal an already exhausted paid source. Evidence: [`live-browser-qa.json`](verification-artifacts/verify-3/live-browser-qa.json).

3. **Returned invalid licenses never leave the progress state.** A real invalid token was stored, removed from the URL, and verified by Sociobot as `{valid:false}`. After network idle, the page still said **License received. Checking it now.** The `onMount` verification assigns `licensed` but never updates `licenseMessage` on invalid or network failure. This violates the required inactive-license notice and gives no recovery direction. Evidence: [`license-live-browser.json`](verification-artifacts/verify-3/license-live-browser.json).

4. **The claims inventory is still incomplete.** Public README statements that the container needs no environment variables, runs non-root, serves `dist`, reports its build SHA, and embeds no payment-provider script have no entries in `.factory/claims.json`. These were manually checked where possible, but the claims contract requires every public claim to be listed and tested.

### Medium

1. **Private workspace API responses do not set `Cache-Control: no-store` or `private`.** Ledger GET responses carry team names, project names, costs, and vendor readings under a bearer URL but have no cache directive. The Sociobot license response correctly uses `no-store`; ledger responses should do the same.

## Passing evidence

### Clean checkout, tests, and production build

- Candidate identity: exact HEAD `14a5c3575fac020d80bd8548f37d976ec7db8ed8` on `main`.
- `npm ci`: PASS; 139 packages installed, 0 vulnerabilities.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- `npm run check`: PASS, 0 errors and 0 warnings.
- `npm test`: PASS, 7 Vitest and 6 Rust tests.
- `cargo clippy --all-targets -- -D warnings`: PASS.
- `npm run build`: PASS; `dist/` produced.
- `cargo build --release`: PASS.
- `npm run test:e2e`: PASS, 30/30 Chromium tests.
- The Docker CLI/daemon is absent in this verifier image, so the Dockerfile could not be built. Review confirms multi-stage `node:22-alpine`/`rust:1-alpine`, non-root runtime, `ARG BUILD_SHA=dev`, no `.git` dependency, and `EXPOSE 8080`.
- The release binary started with an empty environment plus `PORT=4190`, defaulted local configuration, served `/health`, passed `verify-url.sh`, and exited cleanly on SIGTERM.

### Live deployment, backend, and recovery paths

- `/health` returns the full candidate SHA.
- Live JS and CSS SHA-256 hashes exactly match local `dist/`.
- 100 concurrent health checks returned 100 HTTP 200 responses.
- Thirty concurrent writes to separate workspaces returned 30 HTTP 200 responses.
- Before scale-out exposed the defect, one new workspace returned the exact saved body on 120/120 reads. After three replicas were active, the offline workspace split into three states as detailed above.
- Invalid workspace, use above limit, negative cost, impossible date, sensitive extra field, and malformed JSON all returned 4xx responses. Boundary values `used == limit`, zero pace, zero monthly cost, and zero spend were accepted by the API.
- Product API burst: 10 HTTP 200 and 50 HTTP 429 from 60 simultaneous requests; all 429 responses had `Retry-After: 0`. Observed allowance: **10 requests**.
- Sociobot verification burst: 30 HTTP 200 and 50 HTTP 429 from 80 simultaneous requests; every 429 had `Retry-After: 4`. Observed allowance: **30 requests**.
- A single browser-origin Sociobot verification returned correct CORS for the product origin and `Cache-Control: no-store`.
- Sign-in is not required, so the Entra authority check is not applicable.
- This is not a library/CLI and not a PWA. No service worker is registered and offline reload is not claimed. The open-page offline queue was tested separately and fails because of replica-local persistence.

### Functional browser coverage

- Sample forecast, fallback controls, project attribution, seven-row CSV export, quoted CSV import, source removal/undo, empty state, free source cap, workspace link, and demo reset were exercised.
- Invalid use above the limit produced an announced recovery message; correction to the exact limit succeeded.
- An impossible calendar date was rejected.
- Demo changes produced no request to another origin. The request log contains only the document, hashed JS/CSS, and original hero image from the product origin.
- Every crawled product link returned 200; `mailto:` was treated as explicit. Unknown page and API routes returned real 404 responses.
- Privacy and Terms pages are present.

### Accessibility, responsive behavior, privacy, headers, and performance

- `/`, `/demo`, `/ledger`, `/privacy`, and `/terms` each have a route title, `lang="en"`, one `h1`, one `main`, landmarks, a skip link, and image alternatives.
- Playwright Axe found zero serious/critical violations on all primary routes and the source dialog; it found zero violations of any impact in these audited states.
- Keyboard-only dialog use puts focus in the first field, traps focus, closes with Escape, and returns focus. The focused trigger has a visible 3 px aqua outline.
- Reduced motion changes animation/transition durations to `0.00001s` and scroll behavior to `auto`.
- At 390 px and with root text enlarged to 200%, horizontal overflow is 0 px. All visible controls measured at least 44×44 CSS px.
- No console or page errors occurred in desktop, mobile, license, or route checks.
- Live HTML uses CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. Hashed assets use one-year immutable caching.
- JS is 72,995 bytes raw / 26.89 KB gzip; CSS is 16,751 bytes raw / 4.57 KB gzip; mobile hero is 23,550 bytes. Initial transfer measured 113 KiB.
- Lighthouse 13 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.4 s, LCP 1.5 s, TBT 20 ms, CLS 0.
- The visual system is product-specific, single-mode by design, and has original-asset provenance in `.factory/design.md`. The 1200×630 social card and 180×180 touch icon are valid.

## Required work

1. Configure the live app with the intended shared PostgreSQL `DATABASE_URL` (and migration path), or use another genuinely shared durable store; verify save, share, offline reconnect, scale-out, and restart against three replicas.
2. Restore the contract price and a working Sociobot billing path, or obtain and document a deliberate brief change before release.
3. Treat zero remaining sessions as exhausted/at risk regardless of pace and add a boundary claim test.
4. Resolve returned-license verification into active, inactive, or retryable error copy.
5. Complete `.factory/claims.json` for every public README/page claim.
6. Add `Cache-Control: no-store` (or an appropriate private directive) to ledger API responses.
