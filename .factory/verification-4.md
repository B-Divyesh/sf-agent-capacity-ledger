# Agent Capacity Ledger capacity forecast verification

## Verdict

**PASS — zero findings and zero untested claims.**

- Work order: `agent-capacity-ledger-verify-4`
- Current milestone: **M1 — capacity forecast wedge**
- Implementation reviewed: `d58431b96c2dbfc6c881861e2119e0e32ebd4f46`
- Prior handoff evidence: `b5ea15cdffaf3e564aed769472d22767a5be010e`
- Deployed build label and documentation pointer: `2e7b32ecb113b44e892417b035c968fc0704ac37`
- Venture-plan documentation baseline: `7ee5720e8cd31eab21bb200492fc509b37b1548a`
- Live URL: <https://agent-capacity-ledger.sociobot.in>
- Verified: 2026-09-05 UTC
- Finding count: **0**
- Untested claim count: **0**

The deployed build reports `2e7b32e` because that documentation-only source commit was used for the image. The only difference from implementation `d58431b` through deployed commit `2e7b32e` is `.factory/handoff.md`. The later `7ee5720` commit changes only `.factory/handoff.md` and `.factory/plan.md`. Live JavaScript and CSS hashes exactly match the clean local build, so the runtime under review is the `d58431b` implementation.

## First screen and core job

Fresh 1280×720 desktop and 390×844 phone contexts both showed these before scrolling:

- Job: **Plan agent capacity before limits stop work**.
- Audience: small engineering teams managing coding subscriptions, project spend, and approved backup tools.
- First action: **Try it with sample data**, with “See a filled team ledger next.”

The action opened `/demo` in one click. The populated output contained Claude Code, Codex, and GitHub Copilot; 274 estimated remaining sessions; $217 monthly source cost; 93% attributed spend; and four project-spend entries. The persistent banner said **Demo — sample data, nothing is saved** and kept **Reset demo** and **Start for real** available.

I changed an exhausted source and added sample spend, then reset. Reset restored the original three sources and four spend entries. Demo activity made no `/api` write and no cross-origin request. **Start for real** opened an empty workspace with no sample source, proving sample changes did not enter real data.

## Claims

All 20 exact `test` commands from `.factory/claims.json` ran independently after `npm ci`. Every command passed and ran the single matching `@claim:<id>` outcome test.

| Claim ID | Result | Independent evidence |
| --- | --- | --- |
| `capacity-forecast` | PASS | Sample forecast passed; a source at 10/10 with zero pace was **At risk** with “No sessions remain before reset. Estimate.” and no infinity value. |
| `csv-export` | PASS | Export contained its header and all seven sample rows. |
| `csv-import` | PASS | An RFC 4180 quoted vendor containing a comma imported with its capacity and cost. |
| `project-spend` | PASS | A project row saved and the attributed percentage changed. |
| `demo-isolation` | PASS | Demo made no API write; exiting opened an empty real workspace. |
| `prompt-privacy` | PASS | The full live demo flow made no cross-origin request. |
| `data-boundary` | PASS | Product forms request no prompt, code, key, or password; an extra `prompt` field returned 422. |
| `server-persistence` | PASS | Local restart test passed; live ledger was exact on 120/120 reads before and 120/120 after a replica restart. |
| `workspace-sharing` | PASS | A bearer workspace link opened the same saved ledger. |
| `private-ledger-cache` | PASS | All checked ledger responses sent `Cache-Control: private, no-store`. |
| `offline-queue` | PASS | An offline edit showed the queued notice, then **Ledger saved** after reconnect; the API returned the edit. |
| `rate-limit` | PASS | 60 same-client live reads returned 10×200 and 50×429; every 429 had `Retry-After`. |
| `health-build` | PASS | `/health` returned healthy status and the deployed build label. |
| `paid-license` | PASS | Recorded valid verification test stored the token, removed it from the URL, and activated the plan. |
| `invalid-license-recovery` | PASS | A real invalid Sociobot response removed the URL token and showed the recovery message and restore field. |
| `license-daily-cache` | PASS | Recorded-response test observed one verification across reload. |
| `source-cap` | PASS | Free fourth source was blocked; recorded valid entitlement permitted it. |
| `approved-fallbacks` | PASS | A fallback selection saved. |
| `policy-boundary` | PASS | No model proxy, credential, or account-sharing workflow exists; the proxy probe returned 404. |
| `team-plan-availability` | PASS | Live copy states $79 per team each month, says checkout is unavailable, and has no buy link. |

The live landing page, product routes, legal pages, README, and operational copy were compared with the inventory. Every current M1 outcome claim maps to one of these entries. Setup statements were exercised by the documented commands. The deletion-request address is an explicit `mailto:` contact, not a promise of automatic deletion; the link is valid. No unlisted shipped-capability claim was found.

## Live browser, accessibility, and recovery paths

- `/`, `/demo`, `/ledger`, `/privacy`, and `/terms` return 200 and set distinct plain-language route titles in the browser. Each has `lang="en"`, one `main`, one `h1`, header/navigation/footer landmarks, a skip link, and no image missing `alt`.
- Full Playwright axe scans found zero violations of any impact on all five routes and in both source and spend dialogs.
- Keyboard checks passed: the skip link becomes visible, dialog focus wraps in both directions, Escape closes the dialog, focus returns to its trigger, and route changes focus the new `h1`. The focus ring measured 3 px aqua.
- At 390 px, every visible interactive target was at least 44×44 CSS px. Normal and 200% text both had zero horizontal overflow.
- Reduced motion produced near-zero animation and transition durations and `scroll-behavior: auto`.
- No console or page error occurred on successful routes or flows. Navigating deliberately to an unknown document produced the browser's expected failed-resource console line for the HTTP 404; the rendered page itself was complete.
- The designed unknown page returned HTTP 404 with title **Page not found — Agent Capacity Ledger**, one `main`, one `h1`, direct copy, and **Return to the ledger**. An unknown API route also returned 404.
- Invalid use above a source limit returned an announced correction message and saved after correction. An impossible date was rejected. Removing then undoing Claude Code restored the linked Atlas migration spend row and fallback relationship.
- Browser history restored the landing route and title. All discovered same-origin links returned 200, `https://sociobot.in/` returned 200, and the deletion contact is explicit `mailto:`. `robots.txt` and `sitemap.xml` returned 200 and list all public routes.
- The live invalid-license response was HTTP 200 with `{valid:false, reason:"invalid"}`, correct product-origin CORS, and `Cache-Control: no-store`. The UI removed the token from the URL and offered recovery.

Offline reload and service-worker updates are not promised. No service worker is registered. The narrower promised open-page offline queue was tested live and passed.

## Backend, persistence, and boundaries

- Only `sf-agent-capacity-ledger` was inspected or restarted. Its active revision was `sf-agent-capacity-ledger--0000012`, with `/data` mounted and both minimum and maximum replicas set to one.
- A unique verification ledger returned the exact saved body on 120/120 live reads. A different workspace identifier remained empty.
- Restarting that one revision replaced its sole replica. After the replacement became the only running replica, the same ledger returned exactly on another 120/120 reads.
- The live API rejected a short workspace ID, use above limit, negative cost, impossible date, an unknown sensitive field, and malformed JSON with 4xx responses. Boundary values of zero remaining capacity, zero pace, zero cost, and zero spend were accepted.
- A same-client 60-request burst returned 10 successful responses and 50 HTTP 429 responses. Every limited response carried `Retry-After: 0`, which is a valid immediate-retry value. Health is exempt and returned 100/100 successful concurrent responses.
- Static JS and CSS are immutable for one year. Ledger data is private and non-storable. CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` are present.
- The release binary started with an empty environment, defaulted to port 8080 and `/data/ledger.db`, served `/health`, and stopped cleanly.

M1 has no authenticated tenants. It intentionally uses disclosed bearer workspace links: possession allows read and edit. I verified that distinct workspace identifiers do not mix data, but do not misclassify that as authenticated tenant isolation. Accounts, server-derived team membership, and denial tests are M2 scope.

## Quality and performance gates

Passed from the clean source checkout:

```sh
npm ci
npm audit --omit=dev
npm test
npm run check
npm run build
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo build --release
npm run test:e2e
./verify-url.sh https://agent-capacity-ledger.sociobot.in
```

Results: 0 npm vulnerabilities; 8 Vitest tests; 6 Rust tests; no Svelte errors or warnings; 36/36 full browser tests; and `dist/` produced. JavaScript is 73,473 bytes raw / 26.98 KB gzip and CSS is 16,753 bytes raw / 4.57 KB gzip. The live initial transfer was 114 KiB.

Fresh mobile Lighthouse: **96 performance, 100 accessibility, 100 best practices, 100 SEO**; FCP 1.4 s, LCP 1.5 s, TBT 230 ms, CLS 0. Playwright axe is the accessibility authority and reported zero violations.

Docker is unavailable in this verifier image, so an exact image build was not rerun. Static review confirms the required multi-stage build, `rust:1-alpine`, `ARG BUILD_SHA=dev`, no `.git` dependency, a non-root runtime user, `/data`, `EXPOSE 8080`, and the built frontend copied into the runtime. The live container plus matching asset hashes exercise the resulting image.

## Earlier finding disposition

| Earlier finding | Current proof |
| --- | --- |
| Rate limit absent | Closed: 50/60 live requests were 429 and all had `Retry-After`. |
| Source removal lost linked spend; undo incomplete | Closed live: spend and fallback both restored. |
| Dialog focus escaped | Closed live: forward/backward wrap, Escape, and focus return passed. |
| Unknown route returned 200 | Closed live: document and API unknown routes return 404; designed page is complete. |
| Claims missing | Closed: 20 listed IDs, 20 unique test tags, 20 independent passing commands, no unlisted shipped claim found. |
| Rust image pinned to a minor release | Closed by Dockerfile review: `rust:1-alpine`. |
| Invalid capacity and CSV relationships accepted | Closed live and locally with announced recovery. |
| Hashed assets lacked immutable caching | Closed live. |
| `verify-url.sh` missing | Closed and passed live. |
| Replica-local SQLite caused lost reads | Closed: mounted `/data`, one replica, 120/120 before and after replacement. |
| Quoted CSV rejected | Closed live. |
| Impossible dates accepted | Closed live. |
| Mobile targets below 44 px | Closed live. |
| Metaphorical 404 copy | Closed live with direct plain words. |
| Cold claim command unreliable | Closed: the first exact claim command passed from the clean dependency setup. |
| Price changed to $9 | Closed live: $79 per team each month. |
| Empty source showed healthy infinity | Closed live: **At risk**, explicit empty message, no infinity. |
| Invalid license stayed in progress | Closed with a real live invalid response and recovery UI. |
| Ledger API lacked private cache headers | Closed live on every persistence read. |

No earlier major, minor, or deployment-only finding remains open.

## Current milestone and external dependencies

M1 is accepted as an anonymous capacity-forecast ledger with isolated demo data, manual/CSV inputs, estimates, bearer-link persistence, open-page offline recovery, and export. Fallback selection and project spend are useful previews, but M3 policy history and reconciliation are not claimed. AI is not needed for this deterministic arithmetic workflow.

External dependencies are recorded separately and do not change this M1 verdict:

1. **Sociobot billing registration:** the recurring $79/team/month product is not registered. The checkout endpoint still deliberately returns 404, and the product plainly says checkout is unavailable. Registration and end-to-end payment are required for M2, not M1.
2. **Sociobot Entra CIAM setup:** identity metadata and redirects are required before M2 can ship accounts and authenticated tenant isolation. Neither is claimed in M1.
3. **Fleet backup policy and restore drill:** required for authenticated M2 team data, not the present anonymous M1 acceptance.

## Evidence

- Reproduction scripts: [live-browser-qa.mjs](verification-artifacts/verify-4/live-browser-qa.mjs) and [live-backend-qa.mjs](verification-artifacts/verify-4/live-backend-qa.mjs)
- Worker evidence: `/work/.evidence/verify-4/` contains the 20 individual claim logs and summary, screenshots, live browser/backend/restart/offline/license/link JSON, and Lighthouse JSON.

**Final verdict: PASS. Finding count: 0. Untested claim count: 0.**
