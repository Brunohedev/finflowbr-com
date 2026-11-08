# Account deletion correction

## Scope and deployed relationships
`/excluir-conta` now uses an authentication-only guard. The dashboard and bank pages retain their original paid guard. An authenticated deletion link on the plans page makes deletion discoverable to users redirected there for inactive access; purchase handlers are unchanged.

Read-only live checks confirmed ON DELETE CASCADE for finance_data, profiles, transactions, plaid_connections, user_entitlements and sync_locks. The existing auth-delete trigger is enabled. No database schemas, triggers, grants or policies were changed.

## Backend ordering
1. Validate the bearer token with auth.getUser; use only the verified user ID.
2. Load every owned Plaid connection. Resolve legacy missing item IDs through production /item/get. Check both token and Item references for other users before any revocation. Shared connections fail closed for manual reconciliation; no unrelated bank account is revoked.
3. Revoke distinct owned Items through production /item/remove, with a 10-second request deadline. ITEM_NOT_FOUND is accepted as already absent; invalid tokens, malformed replies and all other errors fail closed. No raw errors, access tokens or credentials are logged or returned.
4. Delete and check owner-scoped budgets and legacy pluggy_connections, the user_id tables without auth cascades. Email-based admin_access/admin_invites and retained legal deletion requests are untouched.
5. Delete the auth identity last. Existing cascades/triggers remove primary data and Plaid credentials in that database operation. Credentials are not explicitly deleted early, preserving retry information if revocation or cleanup fails.

Failures produce a sanitized 503 response, never success. Earlier provider removals or non-cascading cleanup may already be complete; the UI explains partial progress and permits another attempt. DELETE confirmation remains mandatory; duplicate submission is guarded and logout/cache clearing occur only after explicit server success. Stripe cancellation remains separate.

## Exact project files changed
- src/components/AuthenticatedRoute.tsx — new authentication-only account-management guard.
- src/App.tsx — only the deletion route switches guard.
- src/pages/Pricing.tsx — adds an authenticated deletion link; no checkout/portal changes.
- src/pages/DeleteAccount.tsx — explicit server-success requirement, submission guard, partial-failure message and separate subscription warning.
- src/i18n/translations.ts — deletion-specific English/Spanish translations.
- supabase/functions/delete-account/index.ts — verified caller, owner-scoped store adapter, checked cleanup, cascaded auth deletion, sanitized failures.
- supabase/functions/delete-account/deletion.ts — testable revocation and cleanup orchestration with bounded production calls.
- src/test/account-deletion.test.ts — 12 backend orchestration/API tests.
- src/test/account-deletion-access.test.tsx — 6 authentication/paid-access isolation tests.
- src/test/delete-account-confirm.test.tsx — 4 confirmation/result tests.
- AGENTS.md — deletion ordering and isolation rule.
- roadmap.md — completion and physical-device verification tracking.
- docs/account-deletion-correction.md — this implementation/validation record.
Project memory also records the user's deletion requirements; it does not change runtime behavior.

## Tests performed
37 tests passed across the three new files and existing get-access, finance-sync, monthly-income, monthly-reset and plaid-ingestion tests. Cases include expired/canceled/inactive authenticated access, signed-out blocking, continued paid-dashboard blocking, multiple Items, shared-reference refusal, missing Item resolution, provider/cleanup/auth failures, already-removed retry, invalid-token failure, sanitization, DELETE confirmation, and explicit-success-only logout.
Preview compilation: build OK. Playwright confirmed signed-out /excluir-conta redirects to /login. The deployed delete-account function rejected an explicitly invalid bearer token with 401; no real identity was deleted or bank connection revoked during verification.

## Remaining risks and release validation
- Authenticated hosted end-to-end checks are unavailable for this external/unmanaged Supabase preview. A disposable test account and physical TestFlight iPhone are still needed for successful deletion and provider-side read-back.
- External provider revocation and non-cascading deletes are not a cross-system transaction. Partial progress is possible and disclosed. Stored credentials remain until auth deletion; ambiguous invalid tokens require support reconciliation rather than false completion.
- Cross-user reference checks are not atomic with concurrent connection creation or ingestion. This narrow correction does not change bank synchronization or introduce locking/schema changes. No shared Item groups were observed in the live check; future shared references are blocked.
- Legacy Pluggy rows are cleaned, but remote legacy Pluggy revocation is outside the specifically approved Plaid scope; previously removed/orphaned provider credentials cannot be reconstructed.
- Administrative invitation/access records and legally retained request records are intentionally preserved. Stripe/provider legal retention remains separate.

Financial calculations, budget allocation, Stripe checkout/subscription/access logic, bank transaction synchronization and authentication architecture were not changed. No schema migration was required.

For native release, update your local project, rebuild and run npx cap sync ios before a new TestFlight build. See https://lovable.dev/blog/convert-lovable-web-app-to-mobile-app .
