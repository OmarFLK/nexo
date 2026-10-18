# Nexo

Gestão da loja Nexo: estoque, precificação por lucro em reais, vendas, compras e financeiro. Uma única loja, sem registros comerciais de demonstração. Interface branca, amarela e preta, adaptada ao celular.

## Abrir no computador

Execute `iniciar-nexo.cmd` ou, com Node 22.13+ (22.x):

```sh
npm ci
npm run dev
```

Acesse http://localhost:3000/login. A conta proprietária solicitada foi criada no banco deste projeto; a senha não está no código. Em uma instalação nova, execute `npm run auth:create-owner` para criar sua conta com entrada oculta. Não existe cadastro público.

Para abrir pelo celular na mesma rede, use `npm run dev:lan` ou `iniciar-nexo.cmd --lan` e o IP informado no terminal. O login também é obrigatório nesse acesso.

## Publicação

O destino preparado é **Vercel (interface) + Render (API e fotos) + Neon (PostgreSQL)**. Siga [DEPLOY.md](./DEPLOY.md) para importar a conta e os dados, configurar variáveis, manter as fotos e validar os serviços. Os arquivos `render.yaml` e `vercel.json` estão incluídos. Nenhum serviço externo é criado automaticamente.

Antes de publicar, leia [a revisão de segurança](./SECURITY_REVIEW.md). Produção exige chave privada entre Vercel e Render, origem HTTPS e papel PostgreSQL restrito. A credencial de migração fica fora do runtime. `npm start` executa a verificação de configuração e conta antes de abrir o serviço; desenvolvimento continua com `npm run dev`.

## Funcionalidades

- Estoque reúne produtos, entradas, saídas, contagem, perdas, fotos e histórico.
- Precificação: informe custo e lucro desejado em reais; o sistema calcula o preço de venda e mostra a margem resultante. Taxas e despesas são opcionais. Usar um produto cadastrado também é opcional.
- Vendas imediatas ou com reserva; cancelamento e devolução preservam o histórico.
- Compras com recebimento parcial e custo médio.
- Financeiro, clientes e fornecedores; conectores de marketplace ainda não implementados.
- Login com senha protegida, sessão com expiração, saída da conta e APIs protegidas.

## Banco e comandos

Sem `DATABASE_URL`, o desenvolvimento usa SQLite em `data/nexo.sqlite`. Com `DATABASE_URL`, o backend usa PostgreSQL. Em produção, PostgreSQL e a URL pública HTTPS são obrigatórios. Fotos usam `NEXO_DATA_DIR/uploads`, em disco persistente no Render. Dados e arquivos `.env*` são ignorados pelo Git.

```sh
npm run db:migrate
npm run auth:create-owner
npm test
npm run typecheck
npm run build
npm run test:api
npm start
```

Os testes que gravam dados usam pastas e credenciais temporárias em `.sites-runtime`. `test:api` inicia e encerra seu próprio servidor na porta 3001. `test:browser` também exige Chromium/Edge com CDP na porta 9222. Nunca use fixtures no banco da operação.

Veja [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) e [SECURITY.md](./SECURITY.md) para os limites e garantias da implementação.
