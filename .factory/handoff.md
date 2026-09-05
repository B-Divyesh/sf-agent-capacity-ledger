# Agent Capacity Ledger handoff

## Independent verification 4 — 2026-09-05

Work order: `agent-capacity-ledger-verify-4`

Verdict: **PASS — zero findings and zero untested claims.**

- Current milestone: **M1 — capacity forecast wedge**.
- Implementation reviewed: `d58431b96c2dbfc6c881861e2119e0e32ebd4f46`.
- Prior handoff evidence: `b5ea15cdffaf3e564aed769472d22767a5be010e`; deployed documentation/build label: `2e7b32ecb113b44e892417b035c968fc0704ac37`; venture-plan baseline: `7ee5720e8cd31eab21bb200492fc509b37b1548a`.
- Product code was not changed. The only new repository files are this report update and verification evidence/report files.
- All 20 declared claim commands passed separately from the clean dependency setup. `npm test`, `npm run check`, `npm run build`, formatting, clippy, release build, the 36-test browser suite, and the live URL verifier passed.
- Fresh desktop and phone sessions showed the job, audience, and sample action before scrolling. The populated sample, persistent label, reset, and exit-to-empty-real-workspace flow passed without a demo API write or cross-origin request.
- All primary routes and both dialogs had zero axe violations. Keyboard, focus return, skip link, 44 px targets, 200% text, reduced motion, titles, history, legal pages, links, and designed 404 behavior passed.
- Live API checks passed validation, private caching, workspace separation, open-page offline recovery, 10-request allowance followed by 50×429 with `Retry-After`, and 100/100 health concurrency.
- The live `/data` configuration remains one mounted replica. A saved ledger returned exactly on 120/120 reads before the verifier restarted only the active product revision and 120/120 reads after its replacement.
- Live JavaScript and CSS exactly match the local production build. Fresh Lighthouse scored 96 performance and 100 accessibility, 100 best practices, and 100 SEO.

Full evidence and rerun details: [`.factory/verification-4.md`](verification-4.md). Worker artifacts are in `/work/.evidence/verify-4/`.

External dependencies remain separate from M1 acceptance: Sociobot must register the recurring $79 product before M2 checkout; M2 also needs Sociobot Entra CIAM setup and a fleet backup/restore drill. The live product correctly says checkout is unavailable and does not present a mock purchase flow.

## Venture planning handoff — 2026-09-05

Work order: `agent-capacity-ledger-plan-1`

Reviewed source/live SHA: `2e7b32ecb113b44e892417b035c968fc0704ac37`

Code changes: none

### Milestone decision

- **M1 — capacity forecast wedge: ACCEPTED.** The accepted boundary is an anonymous, pilot-grade capability workspace with manual/generic CSV readings, labeled forecasts, isolated sample data, reconnect recovery, durable single-replica persistence, and export.
- **M2 — accounts, tenant isolation, and paid subscription: NEXT.** Sign-in, authenticated teams, authorization isolation, and a working subscription are not current capabilities.
- **M3 — approved handoffs and cost reconciliation: PLANNED.** The current fallback selector and manual spend rows are useful demonstrations, but they do not yet prove policy approval/history or reconciliation against total subscription cost.

The controlling contract is [`.factory/plan.md`](plan.md). It records the PRD, architecture, data boundaries, design system, M1–M3 definitions of done, claims/tests, risks, and external dependencies.

### Planner verification

Fresh local checks on the reviewed source:

- `npm ci`: pass, 0 vulnerabilities.
- `npm test`: pass, 8 frontend tests and 6 Rust tests.
- `npm run check`: pass, 0 errors and 0 warnings.
- `npm run build`: pass; `dist/` produced, JS 26.98 KB gzip and CSS 4.57 KB gzip.
- `cargo fmt --check`: pass.
- `cargo clippy --all-targets -- -D warnings`: pass.
- `cargo build --release`: pass.
- `npm run test:e2e`: pass, 36/36 Chromium tests, including all 20 tagged claims.
- `./verify-url.sh https://agent-capacity-ledger.sociobot.in`: pass.

Fresh live checks against build `2e7b32ec…`:

- `/`, `/demo`, `/ledger`, `/privacy`, and `/terms` each had one `<h1>`, one `<main>`, no 390 px overflow, no console/page errors, and no serious/critical Playwright axe finding.
- One click opened three sample sources and four sample spend entries; the persistent demo banner exposed reset and exit, and exiting showed an empty real workspace.
- A unique real ledger write returned 200; 30 reads from distinct synthetic clients returned the exact saved body; a second unique workspace remained empty.
- An offline browser edit showed its queued state, saved after reconnect, and was present in a direct API read.
- An exhausted source with zero daily pace displayed **At risk**, with no infinity text.
- Ledger reads sent `Cache-Control: private, no-store`.
- A 60-request same-client burst returned 10 HTTP 200 and 50 HTTP 429; every 429 had `Retry-After`.
- The Sociobot checkout endpoint returned HTTP 404 with an unavailable-product response. No checkout, payment, or subscription was treated as implemented.

The prior repair handoff below supplies the product-scoped live restart/redeploy persistence evidence and Lighthouse result. Historical independent verification files describe older failed SHAs; their closed findings and the remaining billing dependency are reconciled in the plan.

### Pending work preserved

1. Factory/operator must register the recurring $79/month Sociobot test/live product before M2 can verify checkout. A product worker must not request payment-provider credentials.
2. Factory/operator must configure product-scoped Sociobot Entra CIAM metadata/redirects before M2 can verify sign-in. Sign-in and tenant isolation are currently absent.
3. M2 must replace bearer workspace authority with server-derived team membership, enforce entitlement on the backend, handle concurrent writes, and prove export/delete plus a product-scoped backup restore.
4. The current license tests use recorded responses; the local cached source-cap state is not payment proof and is bypassable.
5. Messaging, HMRC, vendor API sync, and AI are not implemented or required through M3.
6. This planner could not run an exact Docker image build because Docker is not present; preserve that check for the next container-capable verifier. The release binary and production build passed.

## Previous repair handoff

Work order: `agent-capacity-ledger-repair-3`
Completed: 2026-09-05 UTC
Live URL: <https://agent-capacity-ledger.sociobot.in>

## Release identity

- Implementation SHA: `d58431b96c2dbfc6c881861e2119e0e32ebd4f46`
- Documentation evidence SHA: `b5ea15cdffaf3e564aed769472d22767a5be010e` (the handoff record commit).
- Live revision: `sf-agent-capacity-ledger--0000011`
- Live `/health` build SHA: `d58431b96c2dbfc6c881861e2119e0e32ebd4f46`

## What changed

- Replaced replica-local database use with SQLite at `/data/ledger.db`. The product now has the durable `sf-agent-capacity-ledger-data` Azure Files mount at `/data` and a fixed one-replica bound. The server still starts without configuration: if `/data` is absent locally it uses `data/` next to the binary.
- Made the single SQLite writer reliable on the mounted share: one pool connection, a 20-second busy timeout, migration retries, and the single-writer `unix-none` VFS. This avoids stale SMB advisory locks after a process restart while the fleet guarantee remains one writer.
- Set private-ledger API responses to `Cache-Control: private, no-store`.
- Corrected a zero-session forecast. It now reports `At risk` and `No sessions remain before reset. Estimate.` rather than `On track` and infinity.
- Corrected the plan price to `$79/team/month`, the researched price. The page does not advertise a checkout because the required Sociobot billing product has not yet been registered.
- Made invalid returned and pasted licenses recoverable. A failed verification clears the optimistic state, explains that the license is not active, and leaves the restore field available.
- Expanded the claims contract to 20 observable claims. The contract test rejects unlisted or duplicate claim tests across all browser specs.
- Kept the one-click sample isolated in its demo storage namespace. It has a persistent sample label, Reset demo, and Start for real; sample actions do not write the real workspace.
- Adjusted the desktop first screen so the job, audience, and `Try it with sample data` action are visible without scrolling at 1280×720, while preserving the 390px phone layout.

## Earlier findings and current disposition

| Finding | Disposition |
| --- | --- |
| Three inconsistent SQLite replicas | Fixed: durable `/data` mount and one replica; write/read/restart/read evidence below. |
| $9 price differed from the researched $79 price | Fixed: product copy and tests use $79. |
| Zero capacity showed infinity and `On track` | Fixed and regression-tested. |
| Invalid returned license remained checking | Fixed and regression-tested. |
| Runtime/security claims were unlisted | Fixed: 20 claims each have exactly one outcome test. |
| Ledger response could be cached | Fixed: live API sends `private, no-store`. |
| Earlier CSV, date, modal, 404, Docker, focus, and source-undo minor findings | Rechecked through the full browser, accessibility, build, and route suites; no regression found. |

## Live evidence

- Confirmed the final revision mounts `sf-agent-capacity-ledger-data` at `/data`, with minimum and maximum replicas both set to one.
- Wrote an isolated workspace named `durable-restart-1788638797197`, then read it 120 times. All 120 reads returned the saved ledger.
- Restarted only `sf-agent-capacity-ledger--0000010` during the durability check, waited for its new replica, and repeated the 120 reads. All 120 returned the same saved ledger. The final redeploy to revision `0000011` was followed by the same persisted read check.
- Confirmed tenant isolation with two isolated workspace identifiers: a write to one never appeared in the other.
- Sent 60 same-client live requests: 10 succeeded and 50 returned `429`, each with `Retry-After`.
- Confirmed live `Cache-Control: private, no-store` on the ledger endpoint and the final `/health` SHA above.
- Opened the live site in fresh desktop and 390px phone browser contexts. Both showed the job, audience, and sample action before scrolling; neither overflowed horizontally. The sample loaded three sources and five spend rows, showed the persistent demo banner, reset cleanly, and Start for real showed no demo sources.
- Fresh desktop and phone browser checks found no console errors. The final accessibility scan found zero serious or critical findings on `/`, `/demo`, `/ledger`, `/privacy`, and `/terms`.

## Verification

All commands below passed from the documented dependency setup:

```sh
npm ci
npm audit --omit=dev
npm run check
npm test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
npm run build
cargo build --release
npm run test:e2e
./verify-url.sh https://agent-capacity-ledger.sociobot.in
```

Each of the 20 exact `test` commands in `.factory/claims.json` was then run independently with `npm run test:e2e -- --grep @claim:<id>`; every command ran one passing outcome test. The full browser suite passed 36 tests.

The no-environment startup check (`env -i ./target/release/agent-capacity-ledger`) served `/health` successfully. The release bundle is 26.98 KB gzip JavaScript and 4.57 KB gzip CSS.

Lighthouse against the live site reported Performance 98, Accessibility 100, Best Practices 100, and SEO 100. The command exited successfully after producing the report, though Chromium printed a non-fatal post-audit tab-crash message. Playwright's in-browser axe checks are the accessibility authority for this handoff; the standalone axe CLI could not locate a system Chrome driver in this worker image.

## How to run and verify locally

```sh
npm ci
npm run dev
# In another terminal
cargo run
```

Open `http://localhost:5173/demo` for the isolated sample, or use the backend at `http://localhost:8080`. For a production-like server build:

```sh
npm run build
cargo build --release
PORT=8080 ./target/release/agent-capacity-ledger
```

Run the verification commands in the section above. The durable restart regression test starts the real binary with a temporary data directory; it does not touch a production workspace.

## Known gap and next step

The only external dependency remains Sociobot billing registration for `agent-capacity-ledger`. Until that product exists at the billing API, a checkout URL would 404, so the site honestly shows the $79/team/month price and says checkout is unavailable. License restore/verification behavior is implemented and tested, but paid checkout must be enabled only after the factory registers the product. No payment provider credentials or mock paid flow were added.
