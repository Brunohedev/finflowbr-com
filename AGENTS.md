# AGENTS.md

- All writes to `finance_data` go through `saveFinanceDataSafely` (src/lib/financeSync.ts), which only updates when `updated_at` matches the version last read — why: the whole finance document is one JSONB row, and blind upserts from stale tabs/devices erased users' expenses.
