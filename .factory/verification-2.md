# Independent verification 2 — FAIL

Candidate: `22623e2e309ddcfc11817861430caa28d8aec677`

Live URL: <https://agent-capacity-ledger.sociobot.in>

Verified: 2026-08-28 UTC

Work order: `agent-capacity-ledger-verify-2`

## Release decision

**FAIL.** The live deployment is the candidate, but the smallest useful product is not reliable in production. Three autoscaled replicas each use an unmounted local SQLite database. A workspace saved successfully, then appeared saved on 39 of 120 API reads and empty on 81. The same link showed the ledger in 7 of 18 fresh browser sessions and an empty ledger in 11. An offline edit displayed **Ledger saved**, but only 19 of 60 subsequent reads contained it. The advertised $79 team-plan checkout also returns HTTP 404.

These are fresh deployment findings. They reproduce the deployment-only persistence gap disclosed by the builder; they are not inferred from that prior report.

## Mandatory gates

### Claims-first gate

`.factory/claims.json` exists and contains 16 structurally valid entries. The first cold invocation of `capacity-forecast` exceeded Playwright's 120-second `webServer` timeout while compiling Rust dependencies and did not run its test body. After compilation completed, every exact command was rerun independently with strict exit-code handling and all 16 passed:

| Claim | Strict rerun |
| --- | --- |
| `capacity-forecast` | PASS |
| `csv-export` | PASS |
| `csv-import` | PASS |
| `project-spend` | PASS |
| `demo-isolation` | PASS |
| `prompt-privacy` | PASS |
| `data-boundary` | PASS |
| `server-persistence` | PASS locally; FAIL live across replicas |
| `workspace-sharing` | PASS locally; FAIL live across replicas |
| `offline-queue` | PASS locally; FAIL live across replicas |
| `rate-limit` | PASS locally and live |
| `paid-license` | PASS with its recorded response; checkout unavailable live |
| `license-daily-cache` | PASS |
| `source-cap` | PASS |
| `policy-boundary` | PASS |
| `sociobot-billing` | PASS only because it asserts the checkout URL, not that checkout works |

Per the acceptance contract, the cold claim-command timeout is itself release-blocking. Individual logs are in [`qa-evidence/claims`](qa-evidence/claims/).

### Cold first-read gate

**PASS on desktop and 390 px mobile.** Without clicking, the first viewport says:

- What it does: “Plan agent capacity before limits stop work.”
- Who it serves: small engineering teams juggling coding subscriptions, spend, and approved backup tools.
- What to do first: **Try it with sample data**, followed by “See a filled team ledger next.”
- One click opens a populated demo with three paid sources, fallback choices, and four spend entries.

The demo banner persistently says **Demo — sample data, nothing is saved** and offers **Reset demo** and **Start for real**. Evidence: [`first-read.json`](qa-evidence/live/first-read.json), [`first-read-mobile.png`](qa-evidence/live/first-read-mobile.png), and [`live-browser-qa.json`](qa-evidence/live/live-browser-qa.json).

## Defects

### Critical

1. **Saved workspaces are inconsistent and can appear lost after autoscaling.**

   - Azure reports `minReplicas: 1`, `maxReplicas: 3`, three running replicas during the probe, no volumes, and no volume mounts.
   - The backend uses `/data/ledger.db` independently in each replica.
   - A successful PUT was returned by only one replica's state: 39/120 later reads returned the saved ledger; 81/120 returned an empty ledger.
   - The actual workspace link showed the saved team in 7/18 fresh browser sessions and “No sources to watch yet” in 11/18.
   - An offline source edit displayed “Ledger saved” after reconnect, yet 19/60 reads contained the source and 41/60 were empty.
   - Impact: save, sharing, and offline-recovery claims fail on the deployed service. `loadRealLedger()` can also overwrite the browser's cached copy with an empty response from another replica.
   - Evidence: [`deployment-config.json`](qa-evidence/live/deployment-config.json), [`replicas.json`](qa-evidence/live/replicas.json), [`persistence-three-replicas.json`](qa-evidence/live/persistence-three-replicas.json), [`browser-sharing-replicas.json`](qa-evidence/live/browser-sharing-replicas.json), and [`offline-replica-flow.json`](qa-evidence/live/offline-replica-flow.json).

### High

1. **The paid plan cannot be purchased.** Both visible **Buy the team plan** links point to `https://api.sociobot.in/api/v1/products/agent-capacity-ledger/checkout`, which returns HTTP 404 with `{"error":"enabled factory product","status":404}`. This blocks the brief's $79/team/month monetization path. License verification itself responds correctly for invalid tokens.

2. **The CSV importer rejects standards-valid quoted fields.** A valid row containing vendor `"Anthropic, Inc"` was rejected as missing or invalid. Vendor usage exports commonly quote commas, so the core ingestion path does not reliably ingest ordinary CSV.

3. **The public claims inventory is incomplete.** The landing page and Terms say Sociobot “handles receipts and refunds,” but the `sociobot-billing` claim/test only checks price, URL origin, and script origin. It neither lists nor proves receipt/refund handling; live checkout is unavailable. README container claims such as no-required-env startup and non-root execution are also absent from `.factory/claims.json`. The claims contract says an unlisted claim is release-blocking even when separate manual evidence exists.

4. **A clean-cache claim command is not reliable.** The first exact claim command timed out at 120 seconds while the backend compiled, before executing the test. The same test passes after the build cache is warm. A clean verifier should not need an undocumented warm-up run.

### Medium

1. **Demo CSV import accepts an impossible calendar date.** `2026-02-30` was accepted and displayed as a source with “Reset in 0 days.” The backend correctly rejects that date, so demo and real validation disagree.

2. **Several mobile targets are below 44×44 CSS pixels.** At 390 px, **Start for real** is about 91×22, each **Edit** control is about 40×44, and footer links are about 21 px tall. Keyboard focus is visible, but the touch-target baseline is not met.

3. **Some 404 copy violates the plain-words rule.** “Outside the chart,” “This page has no reading,” and “The ledger only maps places that exist” are product metaphors rather than a direct explanation that the page was not found.

## Passing evidence

### Clean checkout and build

- Candidate identity before QA: `22623e2e309ddcfc11817861430caa28d8aec677`; the tree had no product changes.
- `npm ci`: PASS, 139 packages, 0 vulnerabilities.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- `npm run check`: PASS, 0 errors and 0 warnings.
- `npm test`: PASS, 6 Vitest tests and 5 Rust tests.
- `cargo clippy --all-targets -- -D warnings`: PASS.
- `npm run build`: PASS; produced `dist/`.
- `cargo build --release`: PASS.
- `npm run test:e2e`: PASS, 28/28 Chromium tests.
- Exact Docker build: not runnable in this verifier image because the Docker CLI is absent (`docker: command not found`). The Dockerfile was reviewed: multi-stage, `rust:1-alpine`, non-root runtime, `ARG BUILD_SHA=dev`, and no `.git` dependency.
- The release binary started with only `PORT` and `PATH`, defaulted `/data` and build SHA, served health, and exited cleanly on SIGTERM.

### Live identity and backend behavior

- `/health` returned the full candidate SHA.
- Azure image: `sociobotregistry.azurecr.io/sf-agent-capacity-ledger:22623e2e309d`; revision `sf-agent-capacity-ledger--0000002`, 100% latest traffic.
- Local and live JS/CSS SHA-256 hashes match exactly.
- Invalid API cases were rejected: used above limit, negative cost, impossible date, missing fallback, unknown `prompt`, and malformed JSON.
- Boundary values `used == limit`, zero daily pace, zero monthly cost, and zero spend were accepted.
- 100 concurrent health requests returned 100 HTTP 200 responses.
- Live product API with three replicas: 180 reads from one forwarded client produced 33 HTTP 200 and 147 HTTP 429; all 147 included `Retry-After` (value `0`). Observed burst allowance: **33 across three replicas**.
- Sociobot verify endpoint: 80 reads produced 29 HTTP 200 and 51 HTTP 429; all 51 included `Retry-After: 4`. Observed allowance: **29** in this replay.
- Unknown product/API routes return real HTTP 404.

### Product flows and recovery

- Sample demo, capacity warning, fallback selection, project attribution, CSV export, ordinary CSV import, source removal/complete undo, empty state, free source cap, and license cache behaviors pass locally.
- A source with use above its limit produced an announced recovery message; correcting it to the exact limit saved successfully.
- Demo export contained its header plus all seven data rows.
- Demo edits produced no cross-origin requests.
- Sign-in is not required, so the Entra authority check is not applicable.
- This is not a PWA: no service worker is registered and the product does not claim offline reload. The open-page offline queue was tested separately.
- Library/CLI consumer packing is not applicable to this web-with-backend artifact.

### Accessibility, responsive behavior, privacy, and performance

- Routes `/`, `/demo`, `/ledger`, `/privacy`, and `/terms` each have a route title, `lang="en"`, one `h1`, one `main`, header/nav/footer landmarks, image alternatives, and a skip link.
- Axe found zero serious/critical violations on all primary routes and the open source dialog. Full axe output had zero violations in the audited states.
- Keyboard-only navigation reaches the sample-data action; Enter opens the demo. Dialog focus enters the vendor field, wraps in both directions, Escape closes it, and focus returns to **Add a source**.
- Focus uses a visible 3 px aqua outline. Reduced motion changes animation/transition duration to `0.00001s` and scroll behavior to `auto`.
- At 390 px, normal and 200% root text have 0 px horizontal overflow. The mobile menu works. No console or page errors were observed.
- Cold landing and the exercised demo issued only same-origin requests. License verification is the documented exception and uses `api.sociobot.in` with correct CORS and `Cache-Control: no-store`.
- HTML and assets send CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. Hashed JS/CSS send `Cache-Control: public, max-age=31536000, immutable`.
- Production sizes: JS 72,606 bytes raw / 26.73 KB gzip; CSS 16,630 bytes raw / 4.55 KB gzip; mobile hero 23,550 bytes; desktop hero 68,206 bytes.
- Lighthouse 13 mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100; LCP 1.50 s, TBT 129 ms, CLS 0, 115,445 bytes transferred. The stricter performance preset scored 97 with LCP 2.17 s and CLS 0.

## Required next steps

1. Use shared durable storage (managed PostgreSQL or a correctly mounted/shared volume) before allowing more than one replica; then repeat save, link-sharing, offline-reconnect, restart, and replica failover tests.
2. Register/enable the Sociobot billing product and verify an end-to-end checkout return before publishing the buy link.
3. Use a real RFC 4180 CSV parser and strict calendar-date validation in both demo and real flows.
4. Bring every interactive target to at least 44×44 CSS pixels and replace metaphorical 404 copy with plain wording.
5. List and test every public claim, and make the first exact claim command reliable on a clean build cache.
