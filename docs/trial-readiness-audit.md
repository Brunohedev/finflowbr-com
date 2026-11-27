# Trial de 72 horas — resultado da etapa 0

Verificação em 27/11/2026 após autorização das etapas preparatórias 0–3.

## Resultado

**Gate de implantação não atendido.** Nenhuma migração, alteração de função, publicação, ativação/configuração de webhook, mudança de secret ou escrita no Stripe foi executada. Apenas documentação e roadmap foram atualizados.

A autorização continua registrada, mas não permite ignorar as condições de validação do plano. A etapa 1 não foi iniciada.

## Produção: leitura atual

- Quatro vínculos customer/subscription consultados individualmente no Stripe Live; em todos, a lista do customer veio completa (`has_more: false`).
- Dois cancelados e dois ativos. Todos usam o Price ID mensal Live já existente, USD 2.990 centavos, sem trial.
- Dois ativos: próximas datas de período/cobrança recorrente previstas em 12/12/2026 17:32:02 UTC e 25/12/2026 00:42:04 UTC. Não houve mudança em customer, assinatura, preço ou calendário.
- Os dois cancelados ainda têm metadados antigos `active` no cadastro. Um possui concessão administrativa; o outro não. A correção para negar acesso pago ao cancelado sem concessão **não foi implantada**. Não afirmar que ele já perdeu acesso.
- Inventário: 46 contas, 21 acessos administrativos, zero `user_entitlements`, 28 documentos financeiros, 12.077 transações, 13 conexões Plaid.
- `subscriptions`, `trial_reservations` e `stripe_events` não existem neste backend.
- Webhook Live continua desativado, URL atual preservada, inscrito apenas em `checkout.session.completed`. Não foi enviado evento de teste a ele.
- Os arquivos atuais de checkout aceitam visitante; exclusão não chama Stripe e a tela informa cancelamento separado. Esses arquivos não foram alterados.

As leituras confirmam estado e inventário, não substituem execução autenticada das funções nem comparação integral de conteúdo financeiro. Não foi possível obter os artefatos efetivamente implantados por estas leituras; os contratos analisados são os do checkout local e a configuração do endpoint Stripe.

## Divergências da referência consultada

Snapshot mais recente acessível do **FinFlow Trial Lab**, commit `04ce0a35`, somente leitura:

1. **Reserva `released`:** `reserve_trial` apaga a linha liberada e cria outra. O plano aprovado exige reaproveitamento do mesmo registro com nova geração. O esquema do Lab não tem geração; esta adaptação ainda precisa de validação isolada.
2. **Concorrência do webhook:** a função registra o evento e consulta `processed_at`; se ainda não estiver processado, outro executor pode iniciar o mesmo trabalho. Não há claim exclusivo, lease com proprietário ou fencing token no esquema/função consultados. Não há, no snapshot, prova dos testes de 20 entregas concorrentes ou recuperação após perda de lease. Isto é uma lacuna de comprovação, não uma alegação de falha observada na produção.
3. **Compatibilidade legada:** o sincronizador do Lab resolve usuário pelos metadados da assinatura/customer e ignora o evento quando não encontra vínculo. Os vínculos de produção são legados. O Lab também não contém a função de confirmação diferenciada proposta nem o cancelamento Stripe na exclusão. Essas adaptações não podem ser consideradas já testadas só por haver aprovação do Lab.
4. **Migração do Lab não reutilizável integralmente:** ela também cria/substitui estruturas de autenticação, triggers financeiros, Plaid e publicação realtime. Copiá-la para produção violaria o escopo. É necessária migração aditiva própria, limitada ao faturamento e validada antes de execução.

## Validação executada

11 arquivos de regressão do projeto original, **54 testes aprovados**: acesso, exclusão autenticada/confirmada, sincronização financeira, isolamento mensal/renda, refresh/ingestão Plaid e voz. Não foram alterados testes nem regras do aplicativo.

Esses testes estabelecem a linha de base local. Não comprovam checkout/cancelamento Live, lease de eventos ou reserva atômica nova.

O pedido de sessão autenticada foi recusado porque o Supabase é gerenciado externamente pelo usuário e a plataforma não pode emitir seus tokens. Nenhuma credencial foi solicitada. Não foram verificados end-to-end o acesso dos dois ativos, o cancelado sem concessão, as concessões administrativas ou a exclusão real. Nenhuma conta foi criada ou excluída.

## Próximo gate e limites

- Reconciliar a versão/evidências aprovadas do Lab com o snapshot disponível; validar em ambiente isolado as adaptações de reserva, claims/leases, recuperação e legado antes de migrar produção.
- Após isso, executar etapa 1 e validar os quatro vínculos e a exclusão existente; só então implantar a correção compatível de acesso da etapa 2.
- A validação autenticada da etapa 2 permanece pendente e não pode ser substituída por metadados antigos ou teste mockado.
- Etapa 3 aguarda os gates anteriores; publicação, webhook Live, escritas no Stripe e iOS continuam exigindo autorizações separadas.

## Rollback nesta etapa

Não há rollback de serviços a executar: nenhum serviço foi modificado. A única mudança persistente desta etapa é a documentação da autorização e do bloqueio, mantida no repositório.