# Arquitetura

- `app/login`: interface de entrada simples; páginas verificam sessão no servidor.
- `app/workspace.tsx`: interface da operação, mobile, recebe apenas usuário e token CSRF.
- `app/pricing.tsx` e `lib/price-for-profit.ts`: calculadora por lucro desejado, independente do estoque.
- `lib/domain.ts`: regras puras, centavos inteiros, validações de estoque, reservas, vendas, compras e auditoria.
- `app/api`: rotas Node, autenticação obrigatória em dados e imagens.
- `server/auth.ts` e `password.ts`: conta proprietária, scrypt, sessões, limites e CSRF.
- `server/database.ts`: seleção explícita de persistência.
- `server/store.ts`: SQLite para desenvolvimento; ledger relacional, cache por revisão e BEGIN IMMEDIATE.
- `server/postgres.ts`: PostgreSQL para o Neon; pool de até 5 conexões, TLS e transações.
- `server/migrations` e `server/postgres`: esquemas separados para os dois bancos.

Na publicação, a Vercel renderiza as páginas e encaminha `/api/*` para o Render. A verificação SSR consulta `/api/auth/session` no Render, encaminhando o cookie. Somente o Render recebe DATABASE_URL. NEXO_API_URL define o proxy na Vercel e deve ficar ausente no Render.

O PostgreSQL guarda o estado comercial da única loja como snapshot JSONB versionado, acompanhado de tabelas separadas para comandos, auditoria, usuários, sessões e limites de login. SELECT FOR UPDATE serializa as alterações da loja; regra de negócio, novo snapshot, idempotência e auditoria são confirmados na mesma transação. Não há cache comercial em memória no PostgreSQL, portanto os processos leem o mesmo estado persistido.

Este modelo atende uma loja com operação pequena. As leituras ainda carregam o histórico inteiro; ele não oferece paginação ou análises SQL por produto como um esquema totalmente normalizado. Para crescer em volume, separar agregados e paginar são próximos trabalhos. O esquema SQLite anterior permanece normalizado para continuidade do desenvolvimento e importação.

Fotos são arquivos protegidos por sessão em disco persistente do Render; PostgreSQL guarda as referências. Não há R2, S3, Cloudinary, Redis, serviço de IA ou marketplace ativo. Artefatos antigos do scaffold podem existir no repositório, mas não fazem parte deste runtime.
