# FinFlow — plano técnico: trial de 3 dias

## Escopo e autorização

Somente planejamento nesta etapa. Não criar recursos, executar SQL, editar código do aplicativo, alterar Stripe/Supabase, publicar ou gerar build iOS. A aprovação do plano não autoriza produção: criação do laboratório e implementação isolada precisam de autorização explícita; produção terá uma aprovação posterior própria.

Preservar USD e os preços/intervalos existentes:
- Mensal $29.90 — `price_1TFJCqETsKMFlYgf17AWyncm`.
- Semestral $187.86 — `price_1TFJDUETsKMFlYgfTeuJbIcE`.
- Anual $299.04 — `price_1TFJFDETsKMFlYgftrXoLKEq`.

Não modificar assinaturas anteriores, login, cadastro, recuperação, magic links, Plaid, áudio, cálculos, orçamento ou Capacitor/CodeMagic. Qualquer impacto adicional exige apresentação e aprovação específica.

## 1. Isolamento concreto — obrigatório

**Outro Lovable (`FinFlow Trial Lab`), outro Supabase e Stripe Sandbox separado.** Não usar rascunho/duplicação com a conexão atual. Produção mantém Supabase `symkogknbjhdesgmvtvc`, credenciais, preços, webhook e build Apple; laboratório usa identificadores, segredos, preços de teste e contas fictícias próprios.

Após autorização e apresentação de possíveis custos:
1. Importar fonte limpa, sem `.env`, segredos, tokens, dados reais, `.git`, builds ou associação Supabase de produção.
2. Conectar somente o novo Supabase, preparar schema/fixtures e configurar segredos de teste por ferramenta segura. Não mudar conexões/variáveis do original nem copiar usuários/chaves privadas de produção.
3. Desativar chamadas bancárias, notificações reais e pipelines iOS apenas no laboratório.
4. Verificar: IDs/destinos de deploy distintos; navegador/funções sem tráfego ao Supabase original; preços/objetos Stripe de teste; webhook rejeita `livemode: true`; segredo e URLs exclusivos; nenhuma automação do original acionada.

**Bloqueio:** editar Edge Functions aqui pode implantá-las automaticamente mesmo sem publicar frontend. Não preparar o novo backend neste projeto. No laboratório, deploy automático deve atingir só o Supabase isolado; se qualquer verificação falhar, parar. Revalidar definições instaladas; migrações históricas não comprovam seu estado.

## 2. Controle de acesso

| Status Stripe | Acesso proposto |
|---|---|
| `trialing` | Completo até `trial_end`, sem pagamento inicial |
| `active` | Completo |
| `past_due` | Suspenso após trial; Stripe continua recuperação |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` | Sem acesso pago |

Cancelamento agendado preserva trial válido; imediato encerra ao confirmar `canceled`. Retorno a `active` restaura acesso. Não alterar retries nem cancelar assinaturas por conta própria.

- `check-subscription` centraliza acesso dependente de cobrança; preservar status real, Customer/Subscription, plano, `trial_end` e datas dos itens na API Basil.
- Nunca transformar `trialing` em `active`, nem substituir negativa confirmada pelo Stripe por `is_active` antigo.
- `getAccess` separa concessões manuais de entitlements de cobrança (`stripe`/`stripe_default`); estes não poderão contornar Stripe. Origens desconhecidas bloqueiam a aplicação até classificação aprovada.
- Indisponibilidade: proposta de snapshot verificado há no máximo **5 minutos**, nunca além do trial/período conhecido. Sem snapshot válido, mostrar indisponibilidade e nova tentativa. Negativa confirmada não ganha tolerância.
- `AuthContext`: alterar somente dados de assinatura/fallback, nunca login/cadastro/recuperação.
- `ProtectedRoute`: reagir a perda confirmada e prazo do trial; encaminhar a planos. Exclusão de conta permanece apenas autenticada.

**Impacto específico a aprovar:** usuários liberados indevidamente por metadados/`stripe_default` podem perder acesso. Primeiro testar fixtures e preservar concessões manuais; revisar população afetada antes de qualquer ativação.

## 3. Identidade e prevenção de trials repetidos

Trial de **3 dias** somente sem assinatura anterior, inclusive cancelada. Paginar histórico de todos os Customers conhecidos. Identidade incerta/falha não autoriza trial; ausência local não comprova elegibilidade. Inelegíveis contratam com cobrança informada.

**Autenticados:** validar JWT no servidor, obter UID/e-mail da sessão e resolver Customer por vínculo confiável. Não aceitar UID/Customer arbitrário do navegador. Registrar aliases somente com evidência.

**Visitantes — aprovação específica necessária:** hoje a sessão é criada antes de conhecer o e-mail. Propor identificação apenas no início do checkout: e-mail e código independente, sem criar sessão Auth/conta antecipada, sem `signInWithOtp` ou magic links. Exige serviço de envio, expiração, limite de tentativas e proteção contra abuso. Apresentar esse impacto antes de implementar.

Combinar identidade confirmada, Customer, histórico e reserva. Fingerprint é auxiliar posterior, sem número/CVC. Outra identidade/cartão permanece limite antifraude.

Sem aprovação, preservar checkout pago de visitantes; seu trial permanece bloqueado.

### Concorrência

Chave canônica por UID/Customer/aliases confirmados; reserva atômica única antes de consultar histórico e criar sessão. Idempotência deriva da reserva persistida: repetição reutiliza sessão; troca de plano só após expirar/reconciliar a anterior.

Timeout não libera reserva: recuperar com mesma chave e falhar fechado se ambíguo. Conclusão consome trial; abandono libera somente após confirmar sessão expirada/não concluída e ausência de assinatura. Idempotência Stripe não substitui transação durável; verificar também históricos legados.

## 4. Webhooks idempotentes e fora de ordem

Validar assinatura sobre corpo bruto; tratar `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`.

- Inbox durável única por ambiente/conta/`event.id`; sucesso HTTP só após persistência.
- Reconciliação serial por Customer consulta estado atual Stripe, incluindo outras assinaturas válidas, em vez de aplicar payload antigo. Timestamp do evento sozinho não garante ordem.
- Lease/fencing e commit condicional/transacional impedem worker vencido de gravar. Novos eventos ficam pendentes; worker agendado com retries recupera crashes, sem depender de memória após HTTP.
- Snapshot billing autoritativo; metadados Auth espelhados não reabrem acesso nem oferecem atomicidade entre sistemas.
- Corrida de criação: relocalizar conta vencedora; replays não duplicam contas. Preservar criação após checkout concluído e magic links atuais; seu envio ausente é problema separado, não será corrigido aqui.

## 5. Armazenamento auxiliar — só laboratório

Propor `billing_customers` (vínculos/snapshot/lease/versão), `billing_trial_claims` (reserva única/sessão/idempotência/consumo), `billing_webhook_events` (inbox/retries) e, se aprovado, `billing_guest_challenges` (desafio protegido/expiração/tentativas).

Writes server-only, sem leitura pública; grants explícitos, RLS, RPCs parametrizadas e `search_path` seguro. Não alterar tabelas financeiras, triggers Auth ou roles, nem reutilizar locks bancários. Migrações por ferramenta somente após aprovação no laboratório. Política de retenção/exclusão antes de produção.

## 6. Checkout e confirmação

- Manter `mode: subscription` e preços/intervalos de cada ambiente.
- Elegível: `subscription_data.trial_period_days: 3`, `payment_method_collection: always`, sem custos iniciais adicionais. Inelegível: checkout pago normal, sem modificar assinatura existente.
- `Pricing`: “3 DIAS GRÁTIS”, valores posteriores e cancelamento, condicionados à elegibilidade.
- Novo `checkout-confirmation`: JWT com ownership ou comprovante temporário assinado/vinculado à sessão para visitante. Validar ambiente, conclusão e vínculo; retornar somente dados necessários, sem e-mail/cartão.
- `Sucesso`: “Teste gratuito iniciado” versus “Pagamento recebido”; pagamento pendente não aparece como recebido. Mostrar confirmação antes de entrar no app.
- Plano, término e valor vêm do Stripe e preview da fatura. Não calcular `hoje + 3` no navegador; informar data prevista, sem prometer hora exata de débito. Stripe pode cobrar após gerar/finalizar a fatura ao fim do trial.

## 7. Arquivos futuros — apenas na cópia isolada

- `create-checkout/index.ts`: identidade/reserva/elegibilidade/sessão.
- `check-subscription/index.ts`: snapshots/resposta/sync de acesso.
- `stripe-webhook/index.ts`: assinatura/inbox/provisionamento.
- Novos `_shared/billing.ts`, `checkout-confirmation`, `billing-reconcile`: política compartilhada, recibo e recuperação.
- Endpoints de desafio de visitante, só se aprovados.
- `getAccess.ts`, `AuthContext.tsx`, `ProtectedRoute.tsx`: somente decisão/dados de assinatura; métodos Auth intocados.
- `Pricing.tsx`, `Sucesso.tsx`: oferta/confirmação, com helpers focados.
- Testes e migrações auxiliares aprovadas; sem refatoração geral.

## 8. Validação e etapas

Testes unitários/integrados e ponta a ponta com fixtures/cartões de teste; Test Clocks quando compatíveis:
- Três planos, cartão obrigatório, fatura inicial zero, `trial_end - trial_start = 259200` segundos, cobrança e intervalos originais.
- Conversão, cancelamentos, falha/recuperação, demais status e tolerância de 5 minutos.
- Histórico anterior, vários Customers, visitantes/autenticados, simultaneidade/troca de plano, crash/timeout, eventos repetidos/invertidos/mesmo timestamp e lease vencido.
- Recibo inválido/expirado/alheio, concessões manuais, login e exclusão autenticada preservados, assinaturas anteriores intactas e zero tráfego à produção.

Reportar testes e limitações.

**Sequência:** aprovar isolamento/custos → aprovar política, armazenamento e visitante → criar/verificar laboratório → reservas/estado/acesso/webhooks → checkout/confirmação → evidências → discutir produção separadamente.

Produção continua bloqueada até autorização própria e avaliação Apple. Reverter código não desfaz trials contratados; nenhuma publicação ou submissão iOS neste trabalho.
