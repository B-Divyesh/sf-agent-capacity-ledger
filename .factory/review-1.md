# Review 1: Plan agent capacity before limits stop work

## Verdict

**PASS — zero findings and zero untested claims.**

- Work order: `agent-capacity-ledger-review-1`
- Current milestone: **M1 — capacity forecast wedge**
- Implementation reviewed: `d58431b96c2dbfc6c881861e2119e0e32ebd4f46`
- Documentation baseline reviewed: `82e21b1ca3b5e1597aa9a2c195962d9996fe50c1`
- Live build label: `2e7b32ecb113b44e892417b035c968fc0704ac37`
- Live URL: <https://agent-capacity-ledger.sociobot.in>
- Reviewed: 2026-09-05 UTC
- Finding count: **0**
- Untested claim count: **0**

The live build label is a documentation-only commit. From implementation `d58431b` through deployed label `2e7b32e`, only `.factory/handoff.md` changed. Later commits through baseline `82e21b1` add or update only factory reports and the venture plan. The live JavaScript and CSS hashes match the clean local production build exactly, so the reviewed runtime is the `d58431b` implementation.

## What the first screen says

Fresh 1280×720 desktop and 390×844 phone browsers showed all three items before scrolling:

- Job: **Plan agent capacity before limits stop work**.
- Audience: small engineering teams managing coding subscriptions, project spend, and approved backup tools.
- First action: **Try it with sample data**, followed by “See a filled team ledger next.”

The action opened `/demo` in one click. The sample showed Claude Code, Codex, and GitHub Copilot; 274 remaining sessions as an estimate; $217 monthly source cost; 93% attributed spend; and four project-spend entries. The persistent label said **Demo — sample data, nothing is saved** and kept **Reset demo** and **Start for real** available.

I changed a source, added spend, and reset the sample. Reset restored the original three sources and four spend entries. Demo activity made no API write and no cross-origin request. **Start for real** opened an empty real workspace. The sample did not read or change real workspace data.

## Declared claims

From a fresh clone of `main` at `82e21b1`, `npm ci` installed the locked dependencies with zero vulnerabilities. Every exact command in `.factory/claims.json` then ran independently. The cold first command passed without a warm-up. Each command ran one matching outcome test.

| Claim | Result | Evidence |
| --- | --- | --- |
| `capacity-forecast` | PASS | The sample forecast passed. A source at 10/10 with zero pace was **At risk**, showed the empty-source explanation, and showed no infinity value. |
| `csv-export` | PASS | The file contained its header and all seven sample rows. |
| `csv-import` | PASS | A quoted vendor containing a comma imported with the expected capacity and cost. |
| `project-spend` | PASS | A project cost saved and changed the attributed percentage. |
| `demo-isolation` | PASS | Demo changes produced no API write; leaving the demo opened an empty real workspace. |
| `prompt-privacy` | PASS | The full demo flow sent no request to another origin. |
| `data-boundary` | PASS | Forms request no prompt, source code, API key, or password; the API rejected an extra `prompt` field with 422 and stored nothing. |
| `server-persistence` | PASS | The local process-restart test passed. Live data matched on 120/120 reads before and 120/120 reads after replacement of the sole replica. |
| `workspace-sharing` | PASS | A fresh browser using the bearer workspace link opened the same saved ledger. This is not authenticated tenant isolation. |
| `private-ledger-cache` | PASS | Every checked ledger response sent `Cache-Control: private, no-store`. |
| `offline-queue` | PASS | A live open-page edit showed the device queue notice, saved after reconnect, and appeared in the API response. |
| `rate-limit` | PASS | Separate 60-request GET and PUT bursts each returned 10×200 and 50×429; every 429 included `Retry-After`. |
| `health-build` | PASS | `/health` returned healthy status and build `2e7b32e…`; 100/100 concurrent health requests succeeded. |
| `paid-license` | PASS | A recorded valid Sociobot response stored the token, removed it from the URL, and activated the local plan state. This is not live payment proof. |
| `invalid-license-recovery` | PASS | A real invalid Sociobot response removed the URL token and showed the recovery text and restore field. |
| `license-daily-cache` | PASS | The recorded-response test observed one verification across a reload. |
| `source-cap` | PASS | The free fourth source was blocked; recorded valid license state permitted it. This is client behavior, not M2 entitlement enforcement. |
| `approved-fallbacks` | PASS | A sample fallback selection saved. This is the M1 preview, not M3 approval history. |
| `policy-boundary` | PASS | No model proxy, password, credential, or account-sharing workflow exists; the proxy probe returned 404. |
| `team-plan-availability` | PASS | The live page says $79 per team each month, says checkout is unavailable, and shows no buy link. |

I also compared the live landing page, ledger, legal pages, README, demo guide, and operating text with the claim inventory. Every current M1 outcome maps to a tested claim. The deletion contact is an explicit `mailto:` route, not an automatic-deletion claim. There is no unlisted offline-reload, tenant-isolation, account, checkout, vendor-sync, or success-rate promise.

## Live use, recovery, and accessibility

- `/`, `/demo`, `/ledger`, `/privacy`, and `/terms` returned 200 with distinct plain titles, `lang="en"`, one `<main>`, one `<h1>`, header, navigation, footer, skip link, and complete image alternatives.
- Full Playwright axe scans found zero violations on all five routes and in both the source and spend dialogs.
- Keyboard checks passed for the skip link, dialog entry, forward and backward focus wrap, Escape, focus return, and route-change focus on the new heading. Invalid source errors used an alert and described the related fields. The focus ring was a 3 px aqua outline.
- At 390 px, every visible action was at least 44×44 CSS pixels. Normal text and 200% text had no horizontal overflow.
- Reduced motion produced near-zero animation and transition durations and automatic scrolling.
- No unexpected console or page error occurred. The browser logged only the expected failed-resource line when deliberately requesting the 404 document.
- The designed 404 returned HTTP 404, used the correct title and page structure, explained the missing page directly, and provided **Return to the ledger**. An unknown API route also returned 404.
- Invalid use above a limit and an impossible date showed direct correction text. A valid quoted CSV imported. Removing a source and choosing Undo restored the source, its linked spend, and its fallback relationship.
- All discovered web links returned 200. The privacy deletion address is an explicit `mailto:` link. `robots.txt` and `sitemap.xml` returned 200 and the sitemap lists all public routes.
- No service worker is registered and offline reload or update delivery is not promised. The narrower open-page offline queue was tested live and passed.

The product-specific dark observatory design matches `.factory/design.md`; it remains readable on phone and desktop. The single-mode decision is explicit. Original image provenance is recorded. CSV import and export already cover the obvious M1 transfer need. The forecast is deterministic, so an AI step would not improve this milestone's core job.

## Backend and live identity

Only `sf-agent-capacity-ledger` was inspected and restarted. The active deployment has one replica, minimum and maximum replicas both set to one, and its own `sf-agent-capacity-ledger-data` volume mounted at `/data`.

- A new isolated ledger saved with HTTP 200 and returned the exact body on 120/120 reads.
- A different workspace identifier stayed empty. This proves workspace separation, not authenticated tenant isolation.
- Restarting only revision `sf-agent-capacity-ledger--0000012` replaced its sole replica. The same ledger then returned exactly on another 120/120 reads.
- Invalid workspace ID, use above limit, negative cost, impossible date, unknown sensitive field, and malformed JSON all returned 4xx responses. Zero remaining capacity, zero pace, zero cost, and zero spend were accepted boundaries.
- Both read and write bursts enforced the allowance with 429 and `Retry-After`. Health remained exempt.
- Ledger responses were private and non-storable. Hashed assets used one-year immutable caching. CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` were present.
- The live invalid-license request returned 200 with `{valid:false}`, exact product-origin CORS, and `Cache-Control: no-store`.

M1 has no authenticated tenants. Anyone holding a workspace link can read and edit that ledger. Accounts, server-derived membership, two-team denial tests, and server-side subscription enforcement are M2 work and are not presented as current capabilities.

## Build, test, and performance results

These checks passed from the fresh checkout:

```text
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

Results: 8/8 frontend unit tests, 6/6 Rust tests, 36/36 browser tests, no Svelte errors or warnings, and `dist/` produced. The production bundle is 73,473 raw bytes / 26.98 KB gzip JavaScript and 16,753 raw bytes / 4.57 KB gzip CSS.

The release binary started with only `PORT`, defaulted its other settings, served health and the built frontend, and stopped cleanly. Docker is not installed in this worker. Static review confirms the multi-stage `node:22-alpine` and `rust:1-alpine` build, `ARG BUILD_SHA=dev`, no `.git` dependency, non-root runtime, `/data`, and `EXPOSE 8080`; the live container and exact asset hashes exercise the produced image.

Fresh mobile Lighthouse scored **100 performance, 100 accessibility, 100 best practices, and 100 SEO**. FCP was 1.35 s, LCP 1.50 s, TBT 60.5 ms, CLS 0, and total transfer was 116,413 bytes.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Live rate limit absent | Closed: fresh GET and PUT bursts each produced 50/60 limited responses with `Retry-After`. |
| Source removal lost linked spend and Undo was incomplete | Closed live: source, spend, and fallback all returned after Undo. |
| Source dialog let focus escape | Closed live: both dialogs wrap focus, close with Escape, and return focus. |
| Unknown documents returned 200 | Closed live: unknown document and API routes return 404; the document has a complete recovery page. |
| Claims were missing | Closed: 20 unique claims, one tagged outcome test each, 20 independent passing commands, and no unlisted current promise. |
| Rust image pinned a minor toolchain | Closed by Dockerfile review: `rust:1-alpine`. |
| Invalid source and CSV relationships were accepted | Closed live and locally with announced correction text. |
| Hashed assets lacked immutable caching | Closed live: one-year immutable policy. |
| `verify-url.sh` was missing | Closed: present and passed against local and live servers. |
| Replica-local SQLite caused inconsistent or lost reads | Closed live: one mounted replica and exact 120/120 reads before and after replacement. |
| Valid quoted CSV fields were rejected | Closed live and locally. |
| Impossible dates were accepted | Closed live and locally. |
| Mobile targets were below 44 px | Closed live: minimum width and height were 44 px. |
| 404 copy used metaphors | Closed live: direct “Page not found” copy. |
| The first cold claim command timed out | Closed: it passed from the fresh dependency setup without a warm-up. |
| The page used the wrong $9 price | Closed live: $79 per team each month. |
| An empty source showed healthy infinity | Closed live: **At risk**, explicit empty text, and no infinity. |
| An invalid license stayed in progress | Closed with a fresh real invalid response and recovery controls. |
| Ledger data lacked private cache headers | Closed on every checked response. |

No earlier critical, high, medium, minor, or deployment-only finding remains open.

## Current milestone and external dependencies

**M1 passes.** It is an anonymous capacity ledger with a one-click isolated sample, manual and generic CSV input, labeled estimates, bearer-link persistence, open-page reconnect recovery, and CSV export. The current fallback and project-spend controls are useful previews; they are not the M3 policy-history and cost-reconciliation promise.

External dependencies are separate from this M1 verdict:

1. **Sociobot billing registration:** the recurring $79 team product is not registered. The checkout endpoint returns the expected 404, and the site says checkout is unavailable. Registration and a real checkout are required for M2.
2. **Sociobot Entra CIAM:** product identity metadata and redirect configuration are required before M2 can ship accounts and authenticated tenant isolation.
3. **Product backup and restore:** the fleet must confirm a product-scoped backup mechanism and complete a restore drill before M2 acceptance.

Evidence is in `/work/.evidence/review-1/`, including individual claim logs, browser results and screenshots, accessibility checks, link crawl, before-and-after restart data, rate-limit results, license and checkout probes, build logs, and Lighthouse JSON.

**Final verdict: PASS. Finding count: 0. Untested claim count: 0.**
