# Trial de 72 horas — estrutura no FinFlow original

## Escopo executado

Confirmação explícita em 27/11/2026, limitada nesta solicitação à migração
aditiva no Supabase original **`symkogknbjhdesgmvtvc`**. O Supabase do Trial
Lab (`msrzwdubyofmktjeebzb`) não foi modificado.

Migrações executadas pela ferramenta oficial:

- `20261127215127_54cfb0c8-deb6-4f2e-840f-deb0a4392cb2.sql`:
  três tabelas, reservas atômicas, processamento exclusivo de eventos,
  cópia dos quatro vínculos existentes e ampliação da limpeza na exclusão.
- `20261127215359_0568dbdd-e6d3-4fd4-a0f0-5bc45f9ceae4.sql`:
  políticas explícitas para acesso exclusivo do serviço às duas tabelas internas.

Tabelas novas: `subscriptions`, `trial_reservations`, `stripe_events`.
Funções novas: `validate_trial_reservation`, `reserve_trial`,
`claim_stripe_event`, `complete_stripe_event`, `release_stripe_event`.
Única função existente ampliada: `delete_user_data()`; mantém os quatro comandos
anteriores, remove assinaturas locais e reservas não consumidas da conta excluída.
Não chama Stripe, não muda gatilhos de autenticação nem revogação Plaid.

O arquivo de tipos foi regenerado automaticamente pela ferramenta; não foi
editado manualmente. Testes adicionados em `supabase/tests/`; regras técnicas
registradas em `AGENTS.md` e andamento em `roadmap.md`.

## Preservação comprovada por leitura após a migração

| Recurso | Antes | Depois | Verificação |
|---|---:|---:|---|
| Contas | 46 | 46 | Contagem |
| Concessões administrativas | 21 | 21 | Contagem e impressão digital de todo o conteúdo |
| Concessões `user_entitlements` | 0 | 0 | Contagem e impressão digital |
| Documentos financeiros | 28 | 28 | Contagem e impressão digital de todo o conteúdo |
| Transações | 12.077 | 12.077 | Contagem e impressão digital de todo o conteúdo |
| Conexões Plaid | 13 | 13 | Contagem; nenhum acesso a tokens nesta validação |
| Assinaturas locais | inexistente | 4 | Vínculos com usuário e cliente verificados |
| Reservas legadas consumidas | inexistente | 4 | Nenhum novo trial para assinantes existentes |
| Eventos novos | inexistente | 0 | Nenhum webhook enviado/ativado |

Impressões digitais antes e depois, idênticas:

- `admin_access`: `909f85f81faa2039d3d61b93f31bcc7b`
- `finance_data`: `fedb9cd4ab89b643e767911b642d375b`
- `transactions`: `b5161a5fd0080b6c3e0e92f2ea53e208`
- `user_entitlements`: `d41d8cd98f00b204e9800998ecf8427e`

Quatro consultas somente de leitura ao Stripe confirmaram cada cliente com
lista completa (`has_more: false`): dois ativos, dois cancelados, todos com o
Price ID mensal existente e sem trial. Datas dos dois períodos ativos mantidas:
12/12/2026 17:32:02 UTC e 25/12/2026 00:42:04 UTC.
Um cancelado e um ativo possuem concessão administrativa; elas permanecem
intactas. `consumed` no backfill significa inelegibilidade por assinatura
preexistente, **não** que esses clientes tenham recebido teste gratuito.

## Validação

**14 testes reais de PostgreSQL isolado**, sem usuários, credenciais ou dados
de produção e sem acesso ao Stripe:

- Reserva pendente reutiliza o mesmo ID e geração.
- Vinte tentativas concorrentes concedem uma única reserva.
- Reserva liberada mantém o ID e incrementa geração, limpando a sessão anterior.
- Histórico consumido impede reutilização por usuário e por e-mail.
- Histórico consumido não pode voltar a liberado.
- Escrita condicionada à geração antiga não vincula Checkout após retomada.
- Vinte entregas concorrentes do mesmo evento têm um único proprietário.
- Perda de lease permite retomada e impede conclusão pelo proprietário antigo.
- Falha recuperável mantém identificadores e permite reprocessamento.
- Espera de recuperação impede retomada antecipada.
- Evento duplicado não substitui identidade do cliente.
- Usuário lê apenas suas assinaturas; somente serviço escreve faturamento.
- Exclusão mantém histórico consumido e concessões/dados não relacionados.
- Reversão inativa restaura limpeza original sem remover concessões.

**54 regressões do aplicativo aprovadas** em 11 arquivos: acesso, confirmação
e exclusão autenticada, finanças, isolamento mensal, renda, Plaid e áudio.
Nenhum teste criou, cancelou ou cobrou assinatura Live.

O linter confirmou **nenhum aviso novo remanescente**. Permanecem os 12
achados de segurança preexistentes: três tabelas antigas sem políticas,
duas funções com caminho de busca mutável, seis concessões de execução em
funções antigas e proteção contra senhas vazadas desativada. Não foram
alterados, pois estão fora do escopo. Há também recomendações de desempenho
preexistentes; a revisão pode ser autorizada separadamente.

## O que ainda NÃO foi implementado/ativado

- Trial com cartão, cobrança inicial zero e duração exata de 72 horas no original.
- Correção do acesso para seguir Stripe em vez de metadados antigos.
  O cancelado sem concessão está registrado como cancelado, mas **a verificação
  publicada ainda não mudou**; não afirmar que já perdeu o acesso pago.
- Reconciliação de assinaturas fora de ordem, consumidor de pendências,
  confirmação de Checkout e exclusão com consentimento/cancelamento.
- Funções versionadas e interface condicionada às capacidades.

A estrutura é preparação, não prova de funcionamento do trial completo.
Os testes acima não substituem fluxo autenticado completo, Test Clocks ou
consentimento na interface publicada. As próximas etapas precisam dos gates
do plano; o fluxo autenticado no Supabase externo continua sem sessão de teste
fornecida. Nenhum endpoint foi editado ou implantado nesta solicitação.
Checkout visitante e exclusão atuais continuam inalterados.
Nenhuma publicação, mudança de secret, ativação/reconfiguração de webhook Live,
escrita no Stripe Live ou build iOS foi executada.

## Reversão antes de ativação

1. Confirmar que nenhum novo chamador, trial ou Checkout depende dessas tabelas.
2. Exportar e guardar com acesso restrito o conteúdo das três tabelas novas,
   inclusive os quatro históricos de inelegibilidade.
3. Submeter, **somente com autorização separada**, o conteúdo integral de
   `supabase/tests/trial_schema_rollback.sql` pela ferramenta de migração.
   O script restaura `delete_user_data()` e remove apenas funções/tabelas novas;
   não usa `CASCADE` e aborta caso exista dependência inesperada.
4. Repetir contagens/impressões digitais e regressões de exclusão/acesso.

Rollback executado e aprovado apenas no PostgreSQL isolado. Não executado em
produção. Depois de ativação, este rollback deixa de ser suficiente: é
necessário desativar chamadores e preservar/resolver trabalho pendente primeiro.