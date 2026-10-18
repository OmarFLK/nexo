# Banco de dados

## Produção: PostgreSQL / Neon

`server/postgres/001_initial.sql` define:

| Tabela | Conteúdo |
| --- | --- |
| nexo_schema_migrations | Versão do esquema e data |
| nexo_workspace | Única loja nexo, revisão e estado comercial JSONB |
| nexo_commands | ID único do comando e hash do payload, autor e data |
| nexo_audit | Histórico de comandos, protegido contra UPDATE/DELETE por trigger |
| nexo_users | Uma conta owner, e-mail único e hash da senha |
| nexo_sessions | Hash do token, usuário, vínculo à credencial, vencimento e atividade |
| nexo_login_limits | Contadores e vencimento da janela de tentativas |

O estado comercial inclui produtos, componentes de kits, saldos, movimentos, snapshots de vendas e custos, compras, contatos, financeiro e regras. O domínio valida cada alteração antes de persistir. Um lock na linha da loja impede duas vendas simultâneas de consumirem a mesma unidade. Se qualquer gravação falhar, o comando inteiro sofre rollback. Repetir o mesmo ID/payload não duplica movimentos; reutilizar ID com outro payload é recusado.

A migração usa advisory lock transacional para inicializações concorrentes. O pool possui limite de conexões e timeout. Não altere uma migração já publicada; próximas mudanças precisam de um novo arquivo/versionamento no executor.

## Desenvolvimento: SQLite

`server/migrations/001_initial.sql` contém stores, app_settings, products, kit_components, contacts, orders, order_items, stock_movements, purchases, finance_entries, pricing_scenarios, channel_prices, cost_history, commands e audit_log. Foreign keys, CHECK, índices e triggers preservam o ledger. A migração 002 acrescenta users, sessions e login_limits.

O arquivo fica em NEXO_DATA_DIR/nexo.sqlite. SQLite usa WAL, busy timeout e transações; cache é invalidado pela revisão. O bootstrap só cadastra a loja Nexo e regras zeradas, sem produtos ou vendas fictícias. A conta proprietária é provisionada por comando separado.

## Importação e recuperação

`scripts/import-local.mjs` transfere um snapshot consistente do SQLite e a conta existente para um PostgreSQL vazio, em transação. A senha nunca é convertida em texto; somente o hash é copiado. Destino com conta, comandos ou revisão comercial é recusado. Fotos precisam ser copiadas separadamente para o disco persistente do Render. Não use a importação inicial para sobrescrever dados em produção.

Backup operacional: PostgreSQL via ferramentas do provedor/pg_dump e arquivos de imagem em cópia separada; teste de restauração em ambiente independente. Consulte DEPLOY.md.
