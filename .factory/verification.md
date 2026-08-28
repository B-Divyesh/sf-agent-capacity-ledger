# Independent verification — FAIL

**Candidate:** `d18808a22c11e8c9b2608874d8b8a6b026443abd`  
**Live URL:** https://agent-capacity-ledger.sociobot.in  
**Verified:** 2026-08-28

## Release decision

**FAIL.** The live service does not enforce its documented API request allowance: 180 concurrent reads from one client all received `200`, with no `429` or `Retry-After`. This is a mandatory backend-service requirement and a claimed capability. There are also destructive-data, keyboard-dialog, HTTP status, caching, claim-contract, and container-contract defects described below.

## First-read result (cold live page)

**Pass.** The first screen plainly says it plans agent capacity before limits stop work, names small engineering teams managing coding subscriptions as its audience, and presents **Try it with sample data** as the first action with “See a filled team ledger next.” One click opened a populated sample ledger.

## Clean-checkout checks

`npm ci` completed with 0 vulnerabilities. Every exact command listed in `.factory/claims.json` was run independently via Playwright’s `/demo` entry point and passed:

| Claim ID | Result |
| --- | --- |
| `capacity-forecast` | PASS |
| `csv-export` | PASS |
| `demo-isolation` | PASS |
| `prompt-privacy` | PASS |
| `server-persistence` | PASS |
| `workspace-sharing` | PASS |
| `offline-queue` | PASS |
| `rate-limit` | PASS locally |
| `paid-license` | PASS |

Additional local checks:

- `npm test`: PASS — 4 Vitest and 2 Rust tests.
- `npm run check`: PASS — 0 errors, 0 warnings.
- `npm run build`: PASS — produced `dist/`.
- `npm run test:e2e`: PASS — 17 tests.
- `cargo build --release`: initiated; see container limitation below.
- Exact `docker build`: not runnable because this worker image has no Docker CLI (`docker: command not found`).

## Live evidence

- `GET /health` returned `{"status":"ok","build_sha":"d18808a22c11e8c9b2608874d8b8a6b026443abd"}`. Live HTML asset names and byte sizes match the local `dist/` build (`index-Dw3lUPuq.js`, 70,180 bytes; `index-B9uzKMab.css`, 16,583 bytes).
- Desktop and 390 × 844 mobile were exercised. Mobile horizontal overflow was 0 px; menu worked.
- Browser console and page-error logs were empty across landing, demo, ledger, Privacy, and Terms.
- Axe Playwright found zero serious or critical findings on `/`, `/demo`, `/ledger`, `/privacy`, and `/terms`.
- Reduced-motion context yielded `0.00001s` animation duration and `scroll-behavior: auto`.
- A fresh live `/demo` context performed Reset and Export with no cross-origin requests. Requests were only the live document, local CSS, and local JS.
- Live HTML and assets send CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. They do **not** send `Cache-Control`.
- Bundle budget passes by raw transfer size: JS 70,180 bytes and CSS 16,583 bytes. Hero assets are 23,550 and 68,206 byte WebP files.
- Lighthouse 12.6.0 could not complete cleanly in this runner because the Chrome tab crashed after auditing; its incomplete report showed performance 0.82 and accessibility/best-practices/SEO 1.0. Do not treat that performance number as a valid release measurement.

## Defects

### Critical

1. **Live API rate limiting is not enforced.**
   - Evidence: on 2026-08-28, 60 parallel then 180 parallel `GET /api/ledger/qa-rate-probe-20260828` requests, each with the same `X-Forwarded-For`, all returned HTTP 200. No response carried `Retry-After`.
   - Expected: after the documented 40-request burst / 20 request-per-second allowance, API responses must be HTTP 429 with `Retry-After`.
   - Impact: a single client can exceed the documented allowance; the live deployment fails the mandatory backend rate-limit contract. Observed allowance: **none**.

### High

1. **Removing a source permanently deletes associated project-spend records; Undo does not restore them.**
   - Evidence in live demo: spend table had 5 rows including its header; removing Claude Code left 4; clicking Undo restored Claude Code but the spend table remained at 4.
   - Impact: ordinary source removal silently loses cost attribution. The action has neither an adequate specific confirmation nor a complete undo, contrary to the product’s destructive-action requirement.

2. **The source dialog does not trap keyboard focus.**
   - Evidence: after opening Add a source and tabbing through its controls, focus moved from Save source to footer Privacy then Terms while the modal remained open.
   - Impact: keyboard and screen-reader users can interact outside an active modal; this fails the required dialog focus-management smoke test.

3. **The deployed server returns a 200 document response for an unknown URL.**
   - Evidence: `GET /does-not-exist-qa` returned HTTP 200 and `index.html`, rather than a real HTTP 404.
   - Impact: broken URL semantics and crawler/error handling; the checked-in `404.html` and Static Web Apps config are not effective for this Rust deployment.

4. **Claim coverage is incomplete despite the required claims file.**
   - Examples of live/README claims without a corresponding observable claim test: CSV *import*; free three-source cap and paid unlimited sources; the product-wide “No prompts collected” / no credentials or vendor passwords promise; daily license-verification limit; and the no-proxy/no-account-sharing boundary.
   - Impact: the claims contract requires every visitor-reliant statement to have exactly one test; the existing claim tests cover CSV export and demo privacy only, not these distinct promises.

5. **Dockerfile violates the mandated build-image contract.**
   - Evidence: `Dockerfile` uses `FROM rust:1.88-alpine`; the backend-service contract explicitly requires `rust:1-slim` or `rust:1-alpine`, never a pinned minor.
   - Impact: the source cannot be accepted as deployment-safe under the factory contract, even though the current live host identifies this commit.

### Medium

1. **Invalid capacity input is accepted without recovery.**
   - Evidence: in live demo, Add a source accepted limit 10 and used 20, then displayed “0 of 10 sessions left” rather than preventing or explaining the inconsistent record.
   - Impact: a capacity forecast can be based on invalid readings; CSV parsing also only checks number finiteness, not non-negative values or used ≤ limit.

2. **Long-lived caching is absent in the live server response.**
   - Evidence: hashed JS and CSS assets returned no `Cache-Control` header, despite `dist/staticwebapp.config.json` specifying immutable asset caching.
   - Impact: misses the required caching policy and causes repeat visits to revalidate/download unnecessarily.

3. **The requested worker `verify-url.sh` is absent.**
   - Evidence: repository search found no such script. Equivalent title/lang/main/alt/console checks were performed through Playwright, but the required script itself could not be run.

## Next steps before release

1. Fix live ingress/rate-limiter integration and demonstrate 429 plus `Retry-After` after the declared allowance on the deployed host.
2. Preserve dependent spend rows on undo (or explicitly confirm the count to be deleted and make undo complete).
3. Implement modal focus containment and return focus for every close path.
4. Serve a genuine 404 status, immutable cache headers, and a Dockerfile based on `rust:1-alpine` or `rust:1-slim`.
5. Validate source and CSV relations; add recovery messages.
6. Add a distinct sandbox claim test for every claim listed above, then rerun independent QA.
