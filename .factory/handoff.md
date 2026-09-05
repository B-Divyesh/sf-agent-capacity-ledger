# Agent Capacity Ledger handoff

Work order: `agent-capacity-ledger-repair-3`
Completed: 2026-09-05 UTC
Live URL: <https://agent-capacity-ledger.sociobot.in>

## Release identity

- Implementation SHA: `d58431b96c2dbfc6c881861e2119e0e32ebd4f46`
- Documentation SHA: recorded in the release handoff commit after this file is written.
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
