# AGENTS.md
- Account deletion uses an authentication-only guard, checks exclusive Plaid Item ownership before production revocation, cleans non-cascading user_id records, and deletes auth last using existing cascades; fail closed without raw provider errors — why: unpaid accounts need deletion without opening paid features or losing retry credentials early.

- CSS owns iOS safe-area spacing using viewport-fit=cover and env() insets; keep native automatic content insets disabled to avoid double spacing. Public login uses its own iOS-only layout rules, not dashboard selectors, to reserve navigation space without affecting authenticated screens.
- Native iOS expense recording captures complete PCM/WAV via Web Audio while web/Android use supported MediaRecorder formats; CI declares microphone usage in the generated iOS plist so recordings reach the unchanged expense workflow.

- Uploaded VSL media uses a CDN asset pointer resolved against the published Lovable origin (also allowed by media-src) and the native VSLVideoPlayer, preserving watched-time gating — why: external hosting rewrites relative asset paths to HTML instead of serving video.

- All writes to `finance_data` go through `saveFinanceDataSafely` (src/lib/financeSync.ts), which only updates when `updated_at` matches the version last read — why: the whole finance document is one JSONB row, and blind upserts from stale tabs/devices erased users' expenses.
- Bank refreshes use the shared in-flight request coordinator from the protected app shell on entry, foreground and focus, with one bounded delayed recheck and cleanup on hide/unmount, not permanent page-local polling — why: purchases available just after opening must not wait for another visit and overlapping refreshes waste requests.
- Bank ingestion is shared server-side logic called directly by authenticated handlers or verified Plaid webhooks; public sync requests derive ownership from validated JWTs — why: reduce function-hop delay without exposing privileged sync to arbitrary callers.
- App-open bank refreshes also ask Plaid to pull from the bank (`/transactions/refresh`), claimed atomically per item via `plaid_connections.last_bank_refresh_at` and throttled to once per 5 minutes — why: without it Plaid only polls banks a few times a day, and each refresh call is billed.
- The wallet mascot tour is presentation-only (src/components/mascot, copy in src/lib/mascotTour.ts) and activates on /onboarding only with ?tour=1 from the public start screen — why: the in-app "Como funciona" and all financial/auth flows must stay unchanged.
