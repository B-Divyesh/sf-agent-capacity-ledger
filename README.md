# Agent Capacity Ledger

Plan paid AI coding capacity before limits stop team work.

Agent Capacity Ledger is for small engineering teams with several coding subscriptions. It forecasts remaining useful sessions, records approved fallback tools, and attributes spend to projects. Forecasts are estimates based on the limits and daily pace the team enters.

The live product is [agent-capacity-ledger.sociobot.in](https://agent-capacity-ledger.sociobot.in). Open [`/demo`](https://agent-capacity-ledger.sociobot.in/demo) to try all core flows with sample data.

## What it does

- Records session limits, current use, reset dates, pace, and monthly costs.
- Warns when estimated capacity may run out before its reset date.
- Assigns approved fallback tools without storing vendor credentials.
- Imports source readings from CSV, records cost by project, and exports the full ledger as CSV.
- Opens the same saved ledger from a private workspace link.
- Keeps demo edits isolated from real workspaces.

The free ledger holds three sources. The team plan is $9 per team each month, but checkout is not available yet. The product deliberately shows no buy link until Sociobot checkout is enabled. Existing team licenses can still be verified; no payment provider script is embedded here.

## Run locally

Requirements: Node 22+, npm, and Rust 1.88+.

```sh
npm install
npm run build
PORT=8080 DATA_DIR=./data cargo run
```

Open `http://localhost:8080`. The container requires no environment variables; `PORT` defaults to `8080` and `DATA_DIR` defaults to `/data`.

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

`npm test` runs the TypeScript forecast/export tests and Rust route tests. Playwright covers every claim in [`.factory/claims.json`](.factory/claims.json), mobile layout, route metadata, and serious accessibility findings.

The API uses `DATABASE_URL` when supplied, which is the deployment path for the shared PostgreSQL database. With no database URL it starts safely with SQLite under `DATA_DIR` for local use. Each replica limits the first `X-Forwarded-For` address to a 10-request burst, refilling at five requests per second. Empty buckets return `429` with `Retry-After`. Demo mode never calls the workspace API.

## Deploy

Build and run the root Dockerfile:

```sh
docker build --build-arg BUILD_SHA="$(git rev-parse HEAD)" -t agent-capacity-ledger .
docker run --rm -p 8080:8080 -v ledger-data:/data agent-capacity-ledger
```

The multi-stage image builds the Svelte app and Rust server. It runs as a non-root user. It listens on `PORT` and serves `dist/`. For local use it stores SQLite data under `/data`; production supplies a shared PostgreSQL `DATABASE_URL` through a container secret. It reports the build SHA at `/health`.

## Privacy and scope

The product never asks for prompts, source code, API keys, or vendor passwords. Real ledger data includes the team label, vendor limits, fallback choices, project names, and costs. See `/privacy` and `/terms` in the app.

This tool plans within vendor rules. It does not proxy models, share accounts, or bypass limits.

## License

MIT. Generated observatory artwork is original to this product; its prompt and provenance are in [`.factory/design.md`](.factory/design.md).
