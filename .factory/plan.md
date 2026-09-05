# Agent Capacity Ledger venture plan

Plan date: 2026-09-05

Reviewed repository and live build: `2e7b32ecb113b44e892417b035c968fc0704ac37`

Current accepted milestone: **M1 — capacity forecast wedge**

Next milestone: **M2 — accounts, tenant isolation, and paid subscription**

This plan is the contract for M1–M3. It distinguishes working product behavior from sample demonstrations and mocked integrations. A later milestone is not a public capability until its own definition of done passes.

## Release decision and capability ledger

M1 is accepted as an anonymous, pilot-grade capacity ledger. It completes the first job: enter source readings, see estimated runway and risk, and preserve the ledger in a capability-link workspace. It does not establish a customer account, an authenticated tenant, or a paid team.

| Capability | Current disposition | Evidence and limit |
| --- | --- | --- |
| Clear landing page and one-click sample | **Accepted in M1** | `/` links to `/demo`; fresh desktop and 390 px checks pass. See `tests/site.spec.ts` and `.factory/handoff.md`. |
| Capacity source entry, generic CSV import, remaining-session forecast, and risk state | **Accepted in M1** | Unit, browser, and live exhausted-source checks pass. Estimates depend only on values the user enters. |
| Anonymous real workspace on durable SQLite | **Accepted in M1 with a narrow boundary** | Live build read/write, reconnect, 30 repeated reads, prior live restart verification, and `private, no-store` pass. The deployment must remain one replica with `/data` mounted. |
| Capability-link sharing | **Accepted only as bearer-link behavior** | The link opens the same ledger. Anyone holding it can read and edit it. This is not authentication or tenant isolation. |
| Approved fallback selector | **Demonstrated, not M3-accepted** | It stores one source-to-source selection. There is no approver, project scope, effective period, or policy history. |
| Project spend and attributed percentage | **Demonstrated, not M3-accepted** | Manual entries and CSV export work. The percentage measures entered rows, not reconciliation against all monthly subscription cost. |
| License return, verification cache, and source-cap UI | **Demonstrated with recorded responses only** | Browser tests intercept Sociobot verification. The source cap is client-side and can be bypassed; the API accepts more than three sources. |
| $79/team/month purchase | **Not implemented** | The site says checkout is unavailable. `https://api.sociobot.in/api/v1/products/agent-capacity-ledger/checkout` returned HTTP 404 on 2026-09-05. |
| Sign-in and authenticated teams | **Not implemented** | There is no identity flow, user/team/membership model, session, or authorization middleware. |
| Tenant isolation | **Not implemented** | Separate workspace IDs were shown to keep rows separate, but a bearer ID grants read/write access. That is not a tenant-isolation test. |
| Messaging, reminders, or email invites | **Not implemented and not required through M3** | M3 uses an in-product handoff view. No email/SMS dependency is assumed. |
| HMRC access | **Not applicable** | This product does not perform tax filing or HMRC work. |
| Vendor APIs or automatic account usage sync | **Not implemented** | M1 accepts manual readings and generic CSV only. No vendor credential is collected. |

Historical verifier reports in `.factory/verification.md`, `.factory/verification-2.md`, and `.factory/verification-3.md` failed older builds. Their persistence, price, CSV, calendar-date, target-size, 404-copy, zero-capacity, invalid-license, cache, claim-inventory, and rate-limit findings are repaired in the reviewed build. Billing registration remains open and is deliberately carried into M2. The exact container image build was not rerun in this planner environment; the Dockerfile was inspected and the current release binary/build gates passed.

## Product requirements

### Customer and situation

The customer is a small engineering team paying for several AI coding subscriptions and APIs. Today an engineering manager or tech lead checks incompatible vendor dashboards, posts screenshots in chat, and maintains a spreadsheet of limits, backup tools, and project costs. The team often discovers a depleted seat only after work stops.

### Promise

Give a team one honest capacity plan that shows likely runout, approved fallback work, and reconciled project cost without collecting prompts or vendor credentials.

### Three jobs the product must nail

1. **Forecast capacity.** Turn current use, limits, reset dates, and pace into clearly labeled remaining-session and runout estimates.
2. **Plan an allowed handoff.** Record which tool may take over for a project when a source is at risk, who approved it, and what constraint applies.
3. **Attribute spend.** Reconcile monthly paid-source cost to projects and expose the unallocated amount so “90% attributed” has a real denominator.

### Monetisation

- Free: one team ledger with up to three sources, demo access, risk forecasts, CSV import/export, and safety/privacy behavior.
- Team: **$79 per team each month**, with more than three sources, authenticated team members, policy history, and monthly cost reconciliation.
- Checkout and entitlement verification use only the Sociobot billing API. Dodo remains behind Sociobot; the product never embeds or calls a payment provider directly.
- This is a recurring subscription from the researched brief, not a one-time license. The exact recurring product must be registered before M2 can pass.
- Accessibility, export, deletion, and safety controls are never paywalled.

### Deliberate exclusions through M3

- No model proxy, prompt capture, source-code capture, API-key storage, credential sharing, or limit bypass.
- No automatic vendor login or scraping. Generic CSV and explicit user entry remain sufficient for M1–M3.
- No AI feature. Forecast arithmetic and allocation rules are deterministic; the Sociobot model gateway adds no necessary value here.
- No email, SMS, Slack, Teams, or other messaging integration. M3 produces an in-product handoff view.
- No tax calculation, accounting filing, or HMRC integration.
- No mobile app, browser extension, or multi-region database through M3.

### Success measure

For a pilot team over one billing cycle:

- at least 90% of paid-source monthly cost is allocated to named projects; and
- user-recorded unexpected limit interruptions fall by 50% against the team's baseline cycle.

No passive analytics are required. M3 may ask the team to record a baseline and interruption count in its own ledger. The product must not claim the success measure until a real pilot produces it.

## Demand evidence and wedge

- [Operations discussion](https://hn.algolia.com/api/v1/items/49164517), 2026-08-04: an operator asks how teams run an expanding open-source AI infrastructure stack.
- [Paid limit complaint](https://github.com/anthropics/claude-code/issues/16157), 2026-01-03: a 724-reaction report says a paid Max subscription can hit usage limits immediately.
- The recurring workaround is vendor dashboards, quota screenshots in chat, and spreadsheets.
- Vendor dashboards show one vendor. Cloud FinOps products explain invoices. The wedge is the decision layer between them: useful-session estimates, allowed fallback paths, and project attribution across coding tools without routing model traffic.

## Architecture

### Current M1 architecture

- One container serves the Vite/Svelte TypeScript frontend and Rust 2021 `axum` API on `PORT` (default 8080).
- `sqlx` stores one JSON ledger per `workspace_id` in SQLite at `/data/ledger.db`; local fallback is `data/ledger.db`.
- The production contract is one replica and the fleet-created `/data` mount. The connection is one-writer and uses a 20-second busy timeout plus `unix-none` VFS because the mounted share can retain advisory locks.
- `GET|PUT /api/ledger/:workspace` validate IDs and payloads. API routes are limited by first `X-Forwarded-For`; health is exempt. Ledger responses are `private, no-store`.
- `GET /health` returns status and build SHA. Logs are structured JSON. Static assets are immutable and security headers are server-set.
- Demo data lives only in component memory and never reads or writes `/api/ledger` or real `ledger:*` browser keys.
- Real browser state uses `ledger:workspace` and `ledger:data:<workspace>` for reconnect recovery. The workspace ID itself is the only access capability.
- License mechanics use `sb_license:agent-capacity-ledger` and a daily verdict cache in local storage, with verification directed to `api.sociobot.in`. No successful live paid path exists.

### Target architecture by M2

Keep the selected stack and single-container shape. SQLite remains under `/data`; shared PostgreSQL is unavailable. Replace the single JSON row as the authorization boundary with migrations for:

- `users(subject, display_name, created_at)` — identity subject, never a password;
- `teams(id, name, created_at)`;
- `memberships(team_id, user_subject, role, created_at)`;
- `sources(id, team_id, vendor, plan, limit, used, daily_pace, resets_on, monthly_cost, notes, revision)`;
- `readings(id, team_id, source_id, used, observed_at)`;
- `projects(id, team_id, name, active)`;
- `spend_entries(id, team_id, project_id, source_id, amount, occurred_on)`;
- `fallback_policies(id, team_id, source_id, fallback_source_id, project_id, approved_by, note, effective_from, retired_at)`;
- `subscriptions(team_id, sociobot_product, status, checked_at, expires_at, encrypted_token)`; and
- `audit_events(id, team_id, actor_subject, action, entity_type, entity_id, happened_at)` with no prompt or source-code field.

Every team-owned query must bind the server-derived `team_id`; a client-supplied team ID never authorizes access. Use revision checks on writes so two members cannot silently overwrite each other. Existing anonymous workspaces remain readable during M2 and may be claimed only through an explicit signed-in confirmation; possession of a legacy link alone never grants access to another authenticated team.

The server validates Sociobot identity tokens using factory-provided CIAM metadata and derives membership from its database. It starts without optional identity configuration so `/`, `/demo`, and `/health` still work, but it must show sign-in as unavailable and must not expose team data until configuration exists.

After hosted checkout returns a license/subscription token, the browser strips it from the URL and sends it once to the same-origin backend. The backend verifies it with Sociobot, binds the entitlement to a team, enforces source limits server-side, and refreshes status no more than daily. If a token must be retained for revalidation, encrypt it with a CSPRNG-generated key persisted under `/data`; never log it. Local storage is not an entitlement authority.

### Jobs and operations

- M1 has no background jobs.
- M2 performs entitlement refresh lazily on authorized use and records structured success/failure events without tokens.
- M3 stores new usage readings and recomputes deterministic forecasts and monthly allocations synchronously. No model call is involved.
- `/health` remains public and exempt from rate limiting. Every other server endpoint is limited; write, auth, invitation, and billing-return routes get stricter allowances and `Retry-After` on 429.
- Customer export is CSV/JSON. M2 adds authenticated team deletion.
- Before M2 acceptance, the factory must confirm a scoped backup policy for `sf-agent-capacity-ledger-data` and complete one restore drill. An application-level consistent SQLite snapshot under `/data/backups` may aid recovery but is not a separate failure-domain backup.

## Data and privacy boundaries

| Boundary | Contract |
| --- | --- |
| Demo | In-memory sample only; no production workspace read/write; reset restores the bundled sample. |
| Anonymous M1 | Bearer workspace ID plus a browser cache. Suitable for non-confidential pilot data only. Anyone with the link can edit. |
| Authenticated M2 | Identity subject maps to membership; all reads/writes are scoped by server-derived team ID. Two-team denial tests are mandatory. |
| Product database | Only team name, source limits/readings, reset dates, fallback policy, project names, costs, membership IDs, entitlement state, and audit metadata. |
| Browser | Offline ledger cache and minimal session/return state. No vendor credential. Billing tokens are removed from URLs; local cache is not authoritative. |
| Sociobot billing | Receives only the license/subscription token needed for verification. No ledger contents. |
| Vendors | No runtime connection through M3. Users supply readings manually or by CSV. |
| Observability | Structured operational metadata only. Never log tokens, workspace capability IDs in full, project names, notes, prompts, or imported row contents. |
| Export/delete | Available to authenticated owners in M2 and never paywalled. Deletion covers rows, browser guidance, retained snapshots, and documented retention. |

## Design system contract

The existing `.factory/design.md` remains authoritative. Its direction is the single-mode **midnight capacity observatory**: an editorial control room where finite capacity appears as reservoirs and measured channels. It is not a generic SaaS dashboard.

### Tokens and rules

- Palette: night `#101421`, slate `#1b2233`, paper `#f4eedf`, mist `#bbc2cf`, coral `#ff8066`, coral ink `#2a0c07`, aqua `#78d8ca`, gold `#e8bd68`, danger `#ff8a93`, line `#394257`.
- Type: Georgia/Cambria display; native sans-serif body/data; tabular figures. Scale: 12, 14, 16, 20, 28, clamp 42–72 px.
- Spacing: 8 px rhythm with 4 px optical correction; primary steps 8, 16, 24, 32, 48, 64, 96.
- Shape: hairline rules, open groups, clipped paper panels, horizontal capacity reservoirs, coral risk stamps.
- Motion: one 180–240 ms tide-reading entrance and short state transitions; no loops; final states render immediately under reduced motion.
- Original generated observatory art and provenance stay recorded in `.factory/design.md`; no new stock or branded assets.

### Component inventory and states

1. Site header and responsive navigation.
2. Skip link and route announcement.
3. Left-aligned job hero with observatory plate.
4. Persistent demo banner with reset and exit.
5. Workspace toolbar with import, export, share, and add actions.
6. Forecast summary strip.
7. Source row with reservoir bar.
8. Text-labeled risk stamp: On track, Watch, or At risk.
9. Approved fallback policy control.
10. Project allocation table.
11. Inline CSV import panel.
12. Source and spend dialogs with focus containment and recovery copy.
13. Empty, loading, offline, saved, rate-limited, and error notices.
14. Undo toast for destructive changes.
15. Team, membership, and billing settings panel.
16. Monthly reconciliation and handoff report.

Each interactive component needs default, hover, pressed, disabled, focus-visible, loading, success, and error states where applicable. Destructive changes require undo or a specific confirmation.

### Five key screens

1. **Landing (`/`)** — job and audience on the left, one sample action in the first viewport, three facts, a real ledger preview, boundaries, honest price/status, and footer.
2. **Demo (`/demo`)** — a filled ledger immediately visible, persistent sample banner, forecast, one risky source, fallback choices, spend rows, reset, and exit.
3. **Team ledger (`/ledger`)** — current cycle totals, source readings, risk explanations, offline/save status, and actions. M2 adds signed-in team context without hiding the forecast behind setup.
4. **Team settings (`/settings/team`, M2)** — members and roles, subscription state, export, deletion, legacy-workspace claim, and clear unavailable/error states.
5. **Monthly plan (`/reports/monthly`, M3)** — source cost versus project allocations, unallocated remainder, at-risk sources with approved handoffs, and a printable/exportable summary.

### Responsive and accessibility rules

- At 390 px, actions stack, source rows become labeled records, the art loses secondary detail, and no table forces horizontal scrolling.
- Every target is at least 44×44 CSS px with at least 8 px separation where controls are adjacent.
- One `<h1>`, ordered headings, landmarks, labels, announced errors/status, visible aqua focus, meaningful image alternatives, and keyboard-complete dialogs are required on every route.
- Text/UI contrast remains at least 4.5:1/3:1. Status never relies on color. Zoom to 200% must preserve content and operation.
- Every route and dialog must pass Playwright axe with no serious or critical findings, and no console/page errors.

## Milestones

### M1 — Capacity forecast wedge — ACCEPTED 2026-09-05

**Purpose:** let a team complete the core forecasting job without setup, while keeping the security boundary honest.

**Routes/screens:** `/`, `/demo`, `/ledger`, `/privacy`, `/terms`, real 404, `/health`, `GET|PUT /api/ledger/:workspace`.

**Accepted scope:**

- one-click isolated sample and reset/exit controls;
- manual and RFC 4180-style generic CSV source input;
- remaining-session, reset, runout, and risk estimates, including exhausted/zero-pace behavior;
- anonymous capability workspace saved to durable SQLite, local reconnect queue, and CSV export;
- explicit privacy/vendor-rule boundaries, honest $79 price, and honest unavailable checkout state;
- responsive, keyboard-operable, accessible visual system with original art;
- API validation, private cache control, structured health/logging, security headers, and per-client rate limiting.

**Accepted claim IDs:** `capacity-forecast`, `csv-export`, `csv-import`, `demo-isolation`, `prompt-privacy`, `data-boundary`, `server-persistence`, `offline-queue`, `rate-limit`, `health-build`, and `policy-boundary`. `workspace-sharing` is accepted only for “same bearer link opens the same ledger,” not as proof of user or tenant authorization. `team-plan-availability` is accepted only as proof that the site states checkout is unavailable.

**Demonstrated but not accepted as later milestones:** `project-spend`, `approved-fallbacks`, `paid-license`, `invalid-license-recovery`, `license-daily-cache`, and `source-cap`. The first two are shallow M3 previews; the other four use recorded/cached browser state and do not prove paid service.

**Definition of done — met:**

- All 20 current claim IDs have exactly one tagged browser test; the full suite ran 36/36 on the reviewed source.
- `npm test`, `npm run check`, `npm run build`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build --release`, and `npm audit --omit=dev` pass.
- Live `/health` reports `2e7b32ecb113b44e892417b035c968fc0704ac37`.
- Fresh live checks pass: 30/30 exact ledger reads, separate workspace remains empty, offline edit persists after reconnect, exhausted source is At risk, and 60-request burst yields 10 successful and 50 limited responses with `Retry-After`.
- `/`, `/demo`, `/ledger`, `/privacy`, and `/terms` have one h1/main, no mobile overflow, no console errors, and no serious/critical axe finding. The live URL verifier passes.
- The repair handoff records a live restart/read/redeploy check on the durable mount. Performance evidence records 98/100/100/100 Lighthouse and 26.98 KB gzip JS / 4.57 KB gzip CSS.

**Evidence paths:** `.factory/claims.json`, `frontend/src/ledger.test.ts`, `frontend/src/claims-contract.test.ts`, `tests/claims.spec.ts`, `tests/durable-persistence.spec.ts`, `tests/site.spec.ts`, `.factory/design.md`, `.factory/demo.md`, and the M1 acceptance section in `.factory/handoff.md`.

### M2 — Accounts, tenant isolation, and paid subscription — NEXT

**Purpose:** turn the anonymous pilot ledger into a safe team subscription without weakening the demo or free forecast.

**Scope:**

- Sociobot Entra CIAM sign-in/sign-out and signed server session/token validation;
- team creation, owner/member roles, membership-controlled reads and writes, and explicit legacy-workspace claim;
- normalized SQLite migrations, revision-based conflict handling, durable restart behavior, export, deletion, and backup/restore drill;
- factory-registered recurring **$79/team/month** Sociobot checkout, return handling, server-bound entitlement, daily status reconciliation, inactive/revoked recovery, and server-side source-cap enforcement;
- no email invites: an owner may copy a short-lived invitation link, and the recipient must sign in before joining;
- demo remains account-free, in-memory, isolated, and fully usable.

**Routes/screens added or changed:** `/sign-in`, `/ledger`, `/settings/team`, `/billing/return`, authenticated `/api/v1/teams/*`, `/api/v1/me`, `/api/v1/billing/*`, export/delete endpoints. Keep legacy `/api/ledger/:workspace` only for an explicit, time-boxed migration path; do not call it tenant-safe.

**Claims to add when implemented:**

- `account-session` — a real configured CIAM user signs in and signs out; demo stays open without an account.
- `tenant-isolation` — team A cannot read, write, join, export, or delete team B using altered IDs or URLs.
- `member-workspace` — an invited signed-in member sees the same team ledger; an expired/revoked invite is denied.
- `team-persistence` — normalized team data survives process restart on `/data` and concurrent edits return a conflict instead of overwriting silently.
- `subscription-checkout` — the registered Sociobot test checkout completes, returns, and activates the correct team at $79/month.
- `subscription-enforcement` — free team is blocked above three sources by the server; active team succeeds; expired/revoked team is locked on the next check.
- `team-export-delete` — an owner exports all team records and can delete the team with an explicit confirmation; a member cannot delete it.
- `backup-restore` — a documented product-scoped backup restores the expected team rows in a clean verification instance.

Each claim gets exactly one `@claim:<id>` test. Local billing tests use recorded Sociobot responses; a verifier must run one real test-mode checkout and one revoke/expiry check after registration. Authentication integration tests use local signed fixtures without checked-in secrets; a verifier separately exercises the configured CIAM path with factory-managed test access.

**Definition of done:**

- All routes derive authorization from the authenticated identity and membership; client IDs alone never grant data access.
- A two-user/two-team API and browser matrix proves allow/deny behavior, including invite, export, delete, and ID tampering.
- The live test-mode hosted checkout completes end to end and the backend, not local storage, enforces entitlement.
- `/data` migration, process restart, concurrent-write conflict, backup, and restore tests pass without modifying another service.
- Demo and all accepted M1 claims remain green. Empty, loading, provider-down, expired-subscription, offline, and conflict states are operable on phone and keyboard.
- Claims inventory, README, privacy, terms, and public copy describe only the verified state.

**Exact blockers:**

1. The Sociobot product is not registered/enabled; checkout returns 404. Factory/operator registration of the recurring product, test product, price, and return URL is required. A product worker must not request or handle provider credentials.
2. Sociobot Entra CIAM metadata/app registration and allowed callback/logout URLs are not configured in the product. Factory/operator configuration is required; no production credential belongs in the repo or handoff.
3. The current API has no auth or membership data and treats a workspace ID as bearer authority. This is implementation work, not evidence of tenancy.
4. The paid source cap is client-only and therefore bypassable. It cannot ship as an entitlement until the backend owns the decision.
5. Product-scoped backup/restore capability for the fleet `/data` share has not been evidenced. The factory must provide or confirm the scoped mechanism before the restore DoD can pass.

### M3 — Approved handoffs and cost reconciliation — PLANNED

**Entry gate:** M2 has an independent PASS. Do not begin M3 while sign-in, tenant isolation, billing, or restore evidence is incomplete.

**Purpose:** complete the second and third jobs on top of a real team boundary.

**Scope:**

- project-scoped fallback policies with primary source, approved fallback, approver, note, effective date, and history;
- an at-risk handoff view showing affected projects and the approved next source, with no automated vendor action;
- monthly reconciliation using source subscription costs as the denominator, project allocations as the numerator, explicit unallocated remainder, and over-allocation prevention;
- source reading history and cycle comparison so pace inputs and forecasts are auditable while still labeled estimates;
- printable and CSV/JSON monthly handoff report; optional user-entered interruption count for the pilot success measure;
- no external messaging or vendor API. Sharing remains inside the authenticated product or by deliberate export.

**Routes/screens added or changed:** `/ledger`, `/policies`, `/reports/monthly`, authenticated policy/allocation/reading APIs.

**Claims to add when implemented:**

- `project-fallback-policy` — an authorized member records an approved fallback for a project and another member sees its approver and history.
- `at-risk-handoff` — when a source becomes at risk, the report names affected projects and their current approved fallback; no policy shows “No approved fallback.”
- `monthly-reconciliation` — total cost equals allocated plus unallocated for the selected month and rejects allocation above source cost.
- `attribution-target` — the report shows the measured percentage against the 90% target using total monthly source cost, not only entered allocation rows.
- `reading-history` — importing a later reading preserves the prior reading and updates the labeled estimate.
- `handoff-export` — CSV/JSON and print output contain the same month, risks, policies, allocation totals, and no hidden credentials or prompts.

**Definition of done:**

- The policy and spend workflows work end to end for two authenticated members and enforce roles.
- Cost math reconciles to the cent across sources, projects, unallocated balances, edits, and deletion/undo.
- Forecast history preserves source observations and makes the input date and estimate label visible.
- A 390 px user can review and act on every at-risk project without horizontal scrolling; print output is readable.
- All M1/M2 claims remain green; new unit, API, browser, accessibility, privacy, and export tests pass.
- One pilot can record baseline/current interruption counts and see attribution progress. No reduction or demand claim is published without actual pilot evidence.

## External dependencies, reported separately

| Dependency | Current state | Milestone impact | Owner/action |
| --- | --- | --- | --- |
| Product DNS/TLS and container ingress | Available at the live product subdomain | M1 accepted | Fleet continues normal product-scoped hosting. |
| `sf-agent-capacity-ledger-data` mounted at `/data`, one replica | Reported and restart-tested by the repair handoff; current live reads are consistent | Required for all milestones | Fleet must preserve the mount and one-replica bound. No shared PostgreSQL is assumed or allowed. |
| Sociobot recurring billing product | **Unavailable; checkout HTTP 404** | Blocks M2 subscription acceptance only | Factory/operator registers the slug, $79 monthly test/live products, and return URL. No product worker needs Dodo or production credentials. |
| Sociobot license/subscription verification API | Endpoint shape exists; current tests use recorded valid/invalid responses | Blocks real entitlement proof in M2 | Factory/operator enables the product; verifier tests the registered test flow once. |
| Sociobot Entra CIAM | **Not configured or implemented** | Blocks M2 account and tenant acceptance | Factory/operator supplies product-scoped public metadata/registration and callback allowlist through the approved mechanism. No credentials are requested in code or docs. |
| Product-scoped durable backup/restore | **Not evidenced** | Blocks M2 restore DoD | Factory/operator confirms a backup mechanism for this product share and permits a scoped restore drill. |
| Messaging provider | None; not integrated | No impact through M3 | Keep out of scope. If a later milestone adds email, it needs a separate dependency and consent review. |
| HMRC access | Not relevant and not integrated | No impact | Keep out of scope. |
| Vendor usage APIs | None; not integrated | No impact through M3 | Continue manual/generic CSV entry; never request vendor credentials. |
| Sociobot AI gateway | Not used | No impact | Deterministic product; do not add AI decoration. |

## Risks and experiments

| Risk or unknown | Experiment that retires it |
| --- | --- |
| “Session” limits differ by vendor and may be opaque or rolling. | Run a one-cycle shadow pilot with three vendors; compare predicted and observed exhaustion, display per-source forecast error, and keep estimates labeled. |
| SQLite on an Azure Files mount with `unix-none` is safe only with one writer process. | Keep one replica; repeat write/read/restart/read and lock-recovery tests on every backend release. If capacity exceeds one replica, stop and redesign within an approved product-owned store rather than scaling SQLite writers. |
| Concurrent team members can overwrite the current JSON ledger. | M2 adds row revisions and a two-browser conflicting-write test that must return a recoverable conflict. |
| A capability link can leak non-confidential M1 data. | M2 authorization tests replace bearer authority. Until then, privacy copy must continue to say anyone with the link can edit. |
| The $79 price may not match willingness to pay. | After billing works, run five pilot purchase interviews and measure hosted-checkout completion; do not change the researched price without a documented brief decision. |
| A manually entered spend percentage can overstate attribution. | M3 reconciles allocations against the monthly source-cost denominator and tests under-, exact-, and over-allocation. |
| Billing or identity provider downtime could lock users out of core data. | M2 tests cached signed-in/entitlement grace, explicit provider-down copy, and an export path; the free demo remains available. |
| Backup exists only in the same failure domain. | Require a factory-confirmed product-scoped restore drill before calling backups complete. |

## Milestone advancement rule

The next builder implements only M2. It must preserve every M1 claim and the demo. M2 becomes accepted only after its real identity, two-team isolation, registered test billing, server entitlement, restart, and restore checks pass. Mocked billing, separate workspace IDs, or a visible sign-in button are demonstrations, not acceptance. M3 begins only after an independent M2 PASS.
