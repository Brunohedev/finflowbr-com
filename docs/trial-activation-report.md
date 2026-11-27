# Trial de 72 horas — ativação no FinFlow original

## O que foi ativado (27/11/2026)

Após autorização explícita do usuário no projeto original **`symkogknbjhdesgmvtvc`**:

1. **Travas do servidor ativadas:**
   - `BILLING_CHECKOUT_V2_ENABLED=true`
   - `BILLING_CHECKOUT_CONFIRMATION_ENABLED=true`
   - `BILLING_DELETE_ACCOUNT_V2_ENABLED=true`
   - `BILLING_STRIPE_CANCELLATION_ON_DELETE_ENABLED=true`
2. **Serviços implantados:**
   - `stripe-webhook`: verificação de assinatura, posse exclusiva via `claim_stripe_event` / `complete_stripe_event` / `release_stripe_event`, reconciliação de assinaturas e consumo de trial via `syncSubscription`, liberação de reservas expiradas em `checkout.session.expired` e preservação do provisionamento visitante legado durante a transição.
   - `check-subscription`: leitura direta do vínculo em `public.subscriptions`, suporte a `trial_end` / `items.data[0].current_period_end` e espelhamento local sem alterar o contrato existente.
   - `create-checkout-v2`: origens permitidas incluindo `https://finflowbr.com` e `https://www.finflowbr.com`.
3. **Webhook Live habilitado na Stripe:**
   - Endpoint `we_1TKp2oETsKMFlYgfKh7AahIx` (`https://symkogknbjhdesgmvtvc.supabase.co/functions/v1/stripe-webhook`) alterado para `status: enabled` com os 8 eventos: `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`.
4. **Interface condicionada por `billing-capabilities` (pronta no preview, aguardando publicação do usuário):**
   - `/planos`: oferta de 3 dias grátis (72h), redirecionamento de visitantes para `/login?mode=register&next=/planos` e checkout autenticado em `create-checkout-v2`.
   - `/sucesso`: confirmação real via `checkout-confirmation` distinguindo trial iniciado, pagamento confirmado e sessão expirada.
   - `/excluir-conta`: aviso obrigatório + checkbox desmarcado de consentimento de cancelamento + confirmação `DELETE` antes de chamar `delete-account-v2`.
   - `/delete-account` e `/privacy`: textos atualizados.
   - Os endpoints legados `create-checkout` e `delete-account` não foram alterados, mantendo a versão publicada atual segura até que o usuário publique o novo frontend.

## Evidências de verificação

- **Testes automatizados:** 20 arquivos, **102 testes aprovados** (incluindo 8 testes do `stripe-webhook`, 6 de exclusão legada e consentida e 4 de frontend de checkout/sucesso).
- **Build:** `build OK`.
- **Verificação real dos endpoints implantados:**
  - `billing-capabilities`: HTTP 200 (`checkout_v2: true`, `checkout_confirmation: true`, `account_deletion_with_cancellation: true`, `trial_seconds: 259200`).
  - `create-checkout-v2` (sem sessão): HTTP 401 `UNAUTHORIZED`.
  - `checkout-confirmation` (sem sessão): HTTP 401 `UNAUTHORIZED`.
  - `delete-account-v2` (sem consentimento): HTTP 400 `CONSENT_REQUIRED`.
  - `stripe-webhook` (sem assinatura): HTTP 400 `No stripe-signature header`.
- **Preservação dos dados de produção:** 4 assinaturas (2 ativas, 2 canceladas), 4 históricos de trial consumidos, 0 eventos falsos, 21 `admin_access`, 0 `user_entitlements`, 28 `finance_data`, 12.077 `transactions` e 13 `plaid_connections`.
- **Preview visual (Playwright):** `/planos` em desktop e mobile (390x844) sem overflow horizontal, exibindo a oferta de 3 dias grátis (72h) e redirecionando visitantes para `/login?mode=register&next=/planos`.

## O que não foi testado em produção

- Não foi executado um checkout real com cartão na Stripe Live nem a exclusão real de uma conta autenticada em produção (para não criar cobranças, reservas reais ou apagar contas).
- A entrega de um evento real assinado pela Stripe ao `stripe-webhook` (validando a correspondência de `STRIPE_WEBHOOK_SECRET`) será confirmada no primeiro evento real ou em teste controlado pela Stripe Dashboard.
- O frontend atualizado ainda não foi publicado em `https://finflowbr-com.lovable.app` nem foi gerado build iOS.

## Rollback imediato

- Definir as travas `BILLING_CHECKOUT_V2_ENABLED`, `BILLING_CHECKOUT_CONFIRMATION_ENABLED`, `BILLING_DELETE_ACCOUNT_V2_ENABLED` e/ou `BILLING_STRIPE_CANCELLATION_ON_DELETE_ENABLED` como `false` desativa imediatamente os fluxos novos sem afetar `create-checkout` nem `delete-account`.
- O endpoint `we_1TKp2oETsKMFlYgfKh7AahIx` pode ser desativado na Stripe (`disabled: true`) a qualquer momento sem perder o estado já salvo em `public.subscriptions`.