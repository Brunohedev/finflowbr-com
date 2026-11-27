# Trial de 72 horas — etapa 2 no FinFlow original

## Escopo executado

Em 27/11/2026, após confirmação explícita do usuário, a etapa 2 foi implantada
no Supabase original **`symkogknbjhdesgmvtvc`**. Nenhuma alteração foi feita no
Trial Lab.

### Acesso compatível

Arquivo alterado: `supabase/functions/check-subscription/index.ts`.

- Mantém os campos existentes `subscribed`, `plan`, `subscription_id` e
  `subscription_end`.
- Mantém `active` e `trialing` como estados que abrem acesso pago.
- Mantém o atalho para concessões `user_entitlements` com acesso ilimitado.
- `admin_access` continua tendo prioridade no `getAccess`, sem chamada ao Stripe.
- Metadados antigos continuam fornecendo identificadores, mas não abrem acesso
  quando o Stripe não confirma uma assinatura ativa ou em trial.
- Quando não há cliente ou assinatura válida, a resposta é negativa e os
  metadados antigos são sincronizados como inativos.

A função foi implantada. A conta cancelada sem concessão agora depende do Stripe
na verificação publicada da função. Conta e dados financeiros não são removidos.

### Serviços novos, bloqueados por padrão

Implantados:

- `create-checkout-v2`
- `checkout-confirmation`
- `delete-account-v2`
- `billing-capabilities`

Nenhum deles é chamado pelo frontend atual. Os três serviços operacionais usam
travas de servidor com padrão desativado. A exclusão com cancelamento exige duas
travas independentes, além de consentimento `DELETE`, versão de consentimento e
autorização explícita para cancelar. O cancelamento usa vínculos diretos de
cliente/assinatura e precisa ser confirmado antes de Plaid ou exclusão começarem.

Verificação real dos endpoints implantados, sem autenticação de usuário e sem
efeitos laterais:

| Endpoint | Resultado |
|---|---|
| `billing-capabilities` | HTTP 200; todas as capacidades `false`; `trial_seconds: 259200` |
| `create-checkout-v2` | HTTP 503; `CHECKOUT_V2_DISABLED` |
| `checkout-confirmation` | HTTP 503; `CHECKOUT_CONFIRMATION_DISABLED` |
| `delete-account-v2` | HTTP 503; `DELETE_ACCOUNT_V2_DISABLED` |

Os fluxos antigos `create-checkout`, `delete-account` e `stripe-webhook` não
foram editados nem implantados. O checkout visitante e a exclusão atualmente
publicada continuam usando esses fluxos antigos.

## Arquivos adicionados

- `_shared/subscriptionState.ts`: regras puras, três Price IDs existentes e
  duração de 259.200 segundos.
- `_shared/billingRollout.ts`: capacidades desativadas por padrão e execução
  condicionada.
- `_shared/stripeProduction.ts`: clientes, vínculos e sincronização protegida por
  geração e horário da leitura.
- `_shared/subscriptionCancellation.ts`: cancelamento por vínculos diretos,
  confirmação e verificação final.
- `delete-account-v2/deletion.ts` e `orchestration.ts`: mesma sequência bancária
  da exclusão atual, precedida pelo cancelamento somente no fluxo novo.
- Testes de acesso, rollout, assinatura, cancelamento e consentimento.

## Validação

- **18 arquivos de teste, 88 testes aprovados**, incluindo 25 novos testes.
- Regras verificadas: 72 horas exatas, Price IDs preservados, `active`/`trialing`
  liberam, cancelado e estados de falha não liberam, concessões administrativas
  e manuais não chamam Stripe, operações desativadas não executam, cancelamento
  falho impede exclusão e consentimento antigo/incompleto é recusado.
- Regressões de Plaid, áudio, finanças, renda, isolamento mensal e exclusão atual
  continuam aprovadas.
- Build mais recente: **build OK**.
- `git diff --check`: sem erros.

Leituras antes e depois da implantação mantiveram:

| Recurso | Antes | Depois |
|---|---:|---:|
| Assinaturas locais | 4 | 4 |
| Ativas | 2 | 2 |
| Canceladas | 2 | 2 |
| Reservas/históricos | 4 | 4 |
| Eventos novos | 0 | 0 |
| Concessões administrativas | 21 | 21 |
| `user_entitlements` | 0 | 0 |
| Documentos financeiros | 28 | 28 |
| Transações | 12.077 | 12.077 |
| Conexões Plaid | 13 | 13 |

Não houve migração nesta etapa.

## Limites e validação ainda pendente

Não foi usada uma sessão autenticada de produção. Portanto, não foi executado um
teste end-to-end com os dois assinantes, o cancelado sem concessão ou as contas
administrativas; a preservação foi verificada por regras, testes e leituras, não
por login dessas contas.

Não foram testados checkout, confirmação, cancelamento ou exclusão reais porque
esses serviços permanecem deliberadamente desativados. O trial ainda não está
visível nem disponível ao usuário. A etapa 3 (interface condicionada) continua
pendente.

Nenhuma publicação do frontend, ativação/configuração de webhook Live, escrita
no Stripe Live, mudança de secrets ou build iOS foi realizada.

## Rollback antes de ativação

- Os serviços novos já estão sem efeito; manter as travas ausentes/desativadas é
  suficiente para impedir seu uso. Removê-los do deploy exige autorização
  separada, mas não exige rollback do banco enquanto não houver uso.
- Se a correção de acesso causar incidente, a versão anterior de
  `check-subscription` pode ser recuperada pelo histórico Git e reimplantada
  isoladamente. Esse rollback restaura também o fallback antigo de metadados e,
  portanto, deve ser acompanhado de correção definitiva, não tratado como estado
  desejado.
- Não há cobrança, sessão, cancelamento ou evento novo a reverter nesta etapa.
- O rollback da estrutura da etapa 1 continua separado e não deve ser executado
  agora, pois `check-subscription` e a preparação atual usam os vínculos locais.
