# Independent QA handoff — FAIL

Work order: `agent-capacity-ledger-verify-3`

Candidate: `14a5c3575fac020d80bd8548f37d976ec7db8ed8`

Live URL: <https://agent-capacity-ledger.sociobot.in>

Verified: 2026-08-28 UTC

## Decision

**FAIL — do not release.** Fresh live evidence reproduces the deployment-only data-loss defect. The active candidate revision has three replicas but only `PORT`; there is no `DATABASE_URL`, secret, or shared volume. After an offline edit displayed **Ledger saved**, 120 cache-busted reads returned the newest ledger 42 times, the previous ledger 39 times, and an empty ledger 39 times.

The full severity-ranked report is [`.factory/verification-3.md`](verification-3.md). Product code was not modified.

## What passed

- All 16 exact claim commands passed after `npm ci`; full Playwright passed 30/30.
- `npm audit --omit=dev`, `npm run check`, `npm test`, strict Clippy, Vite production build, and Rust release build passed.
- The live health identity and JS/CSS hashes match the candidate.
- First-read/demo, normal CSV and spend flows, invalid-input recovery, keyboard, mobile, reduced motion, and browser privacy checks passed.
- Axe found zero serious/critical findings. Lighthouse mobile scored 100/100/100/100 with 1.5 s LCP and 0 CLS.
- Product API rate limit: observed allowance 10; 50/60 requests returned 429, all with `Retry-After`.
- Sociobot verify rate limit: observed allowance 30; 50/80 returned 429, all with `Retry-After`.

## Blocking defects

1. **Critical:** three replica-local SQLite databases make saved, shared, and offline-recovered ledgers inconsistent.
2. **High:** the acceptance contract says $79/team/month; the candidate advertises an unavailable $9/month plan.
3. **High:** zero remaining capacity at zero pace is labeled **On track** for “∞ days.”
4. **High:** an invalid returned license remains stuck on **Checking it now**.
5. **High:** multiple public README runtime/security statements remain absent from `.factory/claims.json`.
6. **Medium:** ledger API responses containing private workspace data lack an explicit private/no-store cache directive.

## Re-run

```sh
npm ci
npm audit --omit=dev
npm run check
npm test
cargo clippy --all-targets -- -D warnings
npm run build
cargo build --release
npm run test:e2e
./verify-url.sh https://agent-capacity-ledger.sociobot.in
```

Use the live persistence probe and deployment snapshots in [`.factory/verification-artifacts/verify-3`](verification-artifacts/verify-3/) after shared storage is configured.
