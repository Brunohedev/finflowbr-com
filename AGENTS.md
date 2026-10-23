# AGENTS.md

- Uploaded VSL media uses a CDN asset pointer and the native VSLVideoPlayer, preserving watched-time gating — why: uploaded video plays directly without depending on YouTube.

- All writes to `finance_data` go through `saveFinanceDataSafely` (src/lib/financeSync.ts), which only updates when `updated_at` matches the version last read — why: the whole finance document is one JSONB row, and blind upserts from stale tabs/devices erased users' expenses.
- Bank refreshes use the shared in-flight request coordinator from the protected app shell on entry, foreground and focus, with one bounded delayed recheck and cleanup on hide/unmount, not permanent page-local polling — why: purchases available just after opening must not wait for another visit and overlapping refreshes waste requests.
- Bank ingestion is shared server-side logic called directly by authenticated handlers or verified Plaid webhooks; public sync requests derive ownership from validated JWTs — why: reduce function-hop delay without exposing privileged sync to arbitrary callers.
- App-open bank refreshes also ask Plaid to pull from the bank (`/transactions/refresh`), claimed atomically per item via `plaid_connections.last_bank_refresh_at` and throttled to once per 5 minutes — why: without it Plaid only polls banks a few times a day, and each refresh call is billed.
