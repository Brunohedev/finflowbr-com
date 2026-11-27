# Trial preparation — authorized scope

Authorization: 27 November 2026, stages 0–3 of the revised compatibility-first sequence.

## Exact affected files and functions

- New additive migration through the migration tool: billing state, atomic reservations, event leases and disabled rollout controls; no changes to existing financial tables or auth triggers.
- `supabase/functions/check-subscription/index.ts`: replace stale-metadata access fallback with confirmed Stripe state while retaining existing response fields and legitimate manual grants.
- New `supabase/functions/_shared/subscriptionState.ts`, `_shared/stripeProduction.ts`, `_shared/billingRollout.ts`: isolated billing helpers.
- New versioned `create-checkout-v2`, `checkout-confirmation`, `delete-account-v2`, `billing-capabilities`: blocked preparation endpoints. Cancellation remains unreachable until separate activation authorization.
- Frontend presentation and routing of billing calls only: `src/pages/Pricing.tsx`, `Sucesso.tsx`, `DeleteAccount.tsx`, `PublicDeleteAccount.tsx`, `Privacy.tsx`; new small hooks/helpers/components as needed. No login or auth-provider changes.
- Targeted tests, this preparation report, roadmap and architecture rules.

## Not authorized

Do not change or deploy the existing `create-checkout`, `delete-account`, `stripe-webhook`, customer portal, Plaid, audio, finance logic, login, magic links, native configuration or CI. Do not publish, activate/configure Live webhooks, write to Stripe Live, or build iOS.

Production deployment and schema changes must stop if a validation gate cannot be demonstrated. Tests creating checkouts, canceling subscriptions or deleting accounts use fixtures/local services only, never real accounts.