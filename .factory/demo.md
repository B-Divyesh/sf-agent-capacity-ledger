# Demo sandbox

- URL: `https://agent-capacity-ledger.sociobot.in/demo` (local: `http://localhost:8080/demo`).
- Sample: three paid sources, two approved fallback paths, four project spend entries, and one source at risk before reset.
- Reset: choose **Reset demo** in the persistent banner.
- Exit: choose **Start for real**. Demo changes are discarded.
- Storage: demo state lives only in Svelte component memory. It never reads or writes the real `ledger:*` browser namespace or `/api/ledger`.
- Verification: all public claims are exercised from `/demo`, except the isolated persistence and rate-limit API checks.
