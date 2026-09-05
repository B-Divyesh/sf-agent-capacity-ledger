# Agent Capacity Ledger

Plan paid AI coding capacity before limits stop team work.

Agent Capacity Ledger is for small engineering teams with several coding subscriptions. It forecasts remaining useful sessions, records approved fallbacks, and attributes spend to projects. Forecasts are estimates based on the readings the team enters.

Try the live [sample ledger](https://agent-capacity-ledger.sociobot.in/demo). The sample never changes a real workspace.

## What it does

- Records session limits, current use, reset dates, pace, and monthly costs.
- Marks a source at risk when it is empty or may run out before reset.
- Records approved fallback tools without asking for vendor credentials.
- Imports source readings from CSV, records cost by project, and exports the full ledger as CSV.
- Opens the same saved ledger from a private workspace link.
- Keeps an open ledger edit on the device during a connection loss, then saves it after reconnecting.

Free ledgers hold three sources. The team plan is **$79 per team each month**. Checkout needs Sociobot product registration and is not available today, so no buy link is shown. Existing team licenses can still be verified.

## Run locally

Requirements: Node 22+, npm, and current stable Rust.

```sh
npm ci
npm run build
cargo run
```

Open `http://localhost:8080`. To choose a different durable location while developing, set `DATA_DIR` before starting the server.

For frontend work, run the API and Vite in separate terminals:

```sh
DATA_DIR=./data cargo run
npm run dev
```

## Test and verify

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
./verify-url.sh http://127.0.0.1:8080
```

Playwright runs every claim in [`.factory/claims.json`](.factory/claims.json). It includes an outcome check that writes a ledger to a temporary durable data directory, restarts the real server, and reads the same data again.

The API limits bursts by the first `X-Forwarded-For` address and returns `429` with `Retry-After`. Ledger API responses use `Cache-Control: private, no-store`.

## Deploy

Build and run the root Dockerfile:

```sh
docker build --build-arg BUILD_SHA="$(git rev-parse HEAD)" -t agent-capacity-ledger .
docker run --rm -p 8080:8080 -v ledger-data:/data agent-capacity-ledger
```

The production deployment uses the product’s `/data` mount and one replica because SQLite has one writer. The server stores its SQLite file at `/data/ledger.db` when that mount is available. `GET /health` reports the running build identifier.

## Privacy and scope

The product never asks for prompts, source code, API keys, or vendor passwords. Real ledger data includes the team label, vendor limits, fallback choices, project names, and costs. See [/privacy](https://agent-capacity-ledger.sociobot.in/privacy) and [/terms](https://agent-capacity-ledger.sociobot.in/terms).

This tool plans within vendor rules. It does not proxy models, share accounts, or bypass limits.

## License

MIT. Generated observatory artwork is original to this product; its prompt and provenance are in [`.factory/design.md`](.factory/design.md).
