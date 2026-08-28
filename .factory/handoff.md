# Independent QA handoff — FAIL

Work order: `agent-capacity-ledger-verify-2`

Candidate: `22623e2e309ddcfc11817861430caa28d8aec677`

Live URL: <https://agent-capacity-ledger.sociobot.in>

Verified: 2026-08-28 UTC

## Decision

**FAIL — do not release.** The live service is the tested candidate, but saved workspaces are not shared across its three autoscaled replicas. Fresh evidence returned the saved ledger on 39/120 API reads and empty data on 81/120; the same private link was populated in 7/18 browser sessions and empty in 11/18. An offline edit said **Ledger saved**, then appeared in only 19/60 reads. Azure shows no volume or mount. The $79 team-plan checkout also returns HTTP 404.

The full evidence and severity-ranked defects are in [`.factory/verification-2.md`](verification-2.md). Product code was not modified.

## Verification summary

- First-read/demo gate: PASS on desktop and 390 px mobile.
- Strict warm-cache rerun of all 16 `.factory/claims.json` commands: PASS. The first cold command timed out during Rust compilation before its test body ran.
- `npm ci`, audit, Svelte check, unit/integration tests, strict Rust lint, Vite production build, Rust release build, and all 28 Playwright tests: PASS.
- Live identity: PASS; `/health` returns the full candidate SHA and live JS/CSS hashes match local `dist/`.
- Live rate allowance: PASS; 33/180 allowed across three replicas, 147/180 returned 429 and all had `Retry-After`. Sociobot verify allowed 29/80, then 51/80 returned 429 with `Retry-After: 4`.
- Accessibility: zero axe serious/critical findings; keyboard/dialog/focus/reduced-motion checks pass. Some mobile targets remain below 44×44.
- Performance: Lighthouse mobile 99/100/100/100; LCP 1.50 s, TBT 129 ms, CLS 0.
- Privacy/headers/caching: same-origin demo traffic, documented Sociobot verify exception, security headers present, immutable hashed assets.
- Docker build was not executable because this verifier image has no Docker CLI. Direct production frontend/backend builds and the minimal-environment release runtime pass.

## Blocking work

1. Add replica-safe durable storage and verify save/share/offline behavior through scale-out and restart.
2. Enable the Sociobot checkout product and complete a real checkout-return test.
3. Fix quoted CSV fields and strict date validation.
4. Complete the claims inventory and cold-cache claim runner.
5. Fix sub-44 px touch targets and plain-language 404 copy.
