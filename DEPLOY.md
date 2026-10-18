# Publicação: Vercel + Render + Neon

A interface fica na Vercel. `/api/*` é encaminhado pelo `proxy.ts` para o Render com uma chave privada de servidor. O Render valida essa chave, a sessão, a origem e o token CSRF antes de alterar dados. O PostgreSQL fica no Neon; fotos ficam no disco persistente do Render.

## Antes de publicar

1. Troque a senha administrativa que já foi enviada no chat. Use uma senha nova, exclusiva, guardada em um gerenciador. O comando abaixo pede e-mail e senha com entrada oculta:

```sh
npm run auth:create-owner -- --reset-password
```

2. Ative autenticação de dois fatores nas contas GitHub, Vercel, Render e Neon.
3. Separe produção de homologação: outro banco/branch e outras chaves. Previews não devem receber credenciais do banco real.

## Neon: migração e conta

Crie um banco vazio. Guarde a conexão do proprietário em `.env.neon` (ignorado pelo Git), usando o campo `DATABASE_MIGRATION_URL`:

```dotenv
DATABASE_MIGRATION_URL=postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require
```

A credencial administrativa é usada somente no terminal de manutenção, nunca na Vercel ou no runtime do Render. Para importar a conta atual e os registros SQLite:

```sh
node --env-file=.env.neon --experimental-strip-types scripts/import-local.mjs
```

A senha é transferida apenas como hash. Sessões não são copiadas. O destino com registros/conta é recusado, sem sobrescrever a operação. Fotos são copiadas separadamente.

Para começar vazio, sem importar o SQLite:

```sh
node --env-file=.env.neon --experimental-strip-types scripts/database.mjs
node --env-file=.env.neon --experimental-strip-types scripts/create-owner.mjs
```

Depois, crie no Neon **via SQL** um papel `nexo_runtime` com senha forte e exclusiva, sem `neon_superuser`, sem associação ao proprietário, sem privilégios administrativos e sem propriedade das tabelas. Aplique `scripts/sql/runtime-grants.sql` como proprietário. O SQL usa banco `neondb`; ajuste esse nome se o seu for outro. A conexão desse papel restrito será `DATABASE_URL` no Render.

O runtime verifica os privilégios e recusa operar com uma conta que possa administrar usuários, apagar auditoria ou criar estruturas. Migrações futuras são executadas separadamente com `DATABASE_MIGRATION_URL`; não ocorrem automaticamente em produção.

Referência: [controle de acesso do Neon](https://neon.com/docs/manage/database-access).

## Chave entre Vercel e Render

Gere 32 bytes aleatórios em hexadecimal:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Guarde o resultado como `NEXO_PROXY_SECRET` nos dois provedores. Não use prefixo `NEXT_PUBLIC_`, não coloque no Git nem compartilhe em mensagens. As chamadas diretas à API do Render sem essa chave recebem 403. `/api/health` é público e revela somente disponibilidade, sem dados comerciais. Rotacione a chave nos dois serviços se houver exposição.

## Render: API e fotos

Use `render.yaml` como Blueprint, ou configure um Web Service Node manualmente. A pasta raiz deve conter `package.json`.

| Configuração | Valor |
| --- | --- |
| Node | 22.x |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |
| `DATABASE_URL` | Conexão Neon do papel restrito `nexo_runtime`, preferencialmente pooled |
| `NEXO_APP_URL` | Origem HTTPS exata da interface, sem caminho |
| `NEXO_PROXY_SECRET` | Chave aleatória compartilhada com a Vercel |
| `NEXO_DATA_DIR` | `/var/data/nexo` |
| `NODE_ENV` | `production` |
| `NEXO_TEST_MODE` | `0` |
| Disco persistente | Montado em `/var/data/nexo` |

Deixe `NEXO_API_URL` e `DATABASE_MIGRATION_URL` **ausentes no Render**. Não execute `next dev` em produção. O servidor usa `PORT` e escuta em `0.0.0.0`. A conta e as migrações precisam existir antes do primeiro início.

O blueprint usa plano pago com disco: confira o custo antes de criar. O filesystem padrão é temporário; o plano gratuito não oferece disco persistente. Copie fotos existentes de `data/uploads` para `/var/data/nexo/uploads`. [Discos do Render](https://render.com/docs/disks).

## Vercel: interface

Importe o mesmo repositório, framework Next.js, Node 22.x. A raiz deve ser a pasta do `package.json`.

| Variável | Valor |
| --- | --- |
| `NEXO_API_URL` | Origem HTTPS do serviço Render, sem caminho |
| `NEXO_APP_URL` | A mesma origem HTTPS pública configurada no Render |
| `NEXO_PROXY_SECRET` | A mesma chave privada do Render |

Não configure `DATABASE_URL` nem `DATABASE_MIGRATION_URL` na Vercel. Configure as variáveis para o ambiente correto e faça novo deploy após alterá-las. Não reutilize chaves ou Neon de produção nos previews. O navegador conversa apenas com `/api` no domínio da interface; não é necessário abrir CORS.

Ative as regras de Firewall/WAF do provedor para tentativas de login e excesso de requisições, conforme recursos do plano. O limite da aplicação não substitui proteção contra DDoS. Se só você usa o sistema, considere também Deployment Protection da Vercel como segunda barreira. [Proteção da Vercel](https://vercel.com/docs/deployment-protection).

## Homologar antes do uso real

Em banco de homologação, confirme:

- HTTPS válido e origem exata; nenhuma credencial em HTML, JavaScript, Git ou logs.
- Login errado recusado; login certo entra; cookie HttpOnly/Secure/SameSite; sair e expirar a sessão bloqueiam dados e fotos.
- Render direto: 403 sem chave; `/api/health`: 200 quando o banco está pronto.
- Produto, alteração de preço, estoque, compra, venda e devolução persistem; concorrência não duplica a mesma unidade.
- Upload falso/corrompido e SVG são recusados; foto válida é WebP sem EXIF e continua após redeploy.
- Origem diferente, CSRF ausente e JSON incorreto são recusados; logs não contêm senha, token ou URL de conexão.
- Backup do PostgreSQL e das fotos restaurado em outro ambiente.

Testes locais automatizados:

```sh
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
npm run build
npm run test:api
npm run test:proxy
npm run security:release
```

`test:proxy` simula frontend e backend separados, com dados temporários. `test:browser` exige Chromium/Edge com CDP na porta 9222. Os testes não conectam ao Neon real.

## Operação, backup e resposta a incidente

Configure retenção/recuperação no Neon conforme o plano; mantenha backups PostgreSQL com `pg_dump` em conexão direta e cópia independente de `/var/data/nexo/uploads`. Proteja backups como os próprios dados e teste restauração regularmente. A importação inicial não é um restaurador para sobrescrever a operação.

Monitore disponibilidade, 5xx, 401/403/429, eventos `security`, espaço em disco e uso do banco. Configure alertas nos provedores. Em caso de credencial exposta: revogue sessões, troque a senha, rotacione chave do proxy e credenciais Neon, confira auditoria e faça rollback se necessário. Remover um segredo do último commit não o apaga do histórico: sempre rotacione.

Não há MFA nativo, recuperação por e-mail ou suporte multiusuário implementados. Para bloquear o acesso durante manutenção, use os controles do provedor. Faça revisão periódica de dependências e aceite as atualizações do Dependabot somente após CI/revisão.
