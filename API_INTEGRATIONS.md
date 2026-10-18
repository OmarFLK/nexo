# API e integrações

As URLs do navegador começam em `/api`. A Vercel encaminha para o backend Render. Não há dependência do ChatGPT ou cadastro público.

| Rota | Acesso e função |
| --- | --- |
| POST /api/auth/login | Origem validada, JSON e rate limit; cria cookie de sessão |
| GET /api/auth/session | Sessão obrigatória; retorna usuário e token CSRF |
| POST /api/auth/logout | Sessão e CSRF; revoga e apaga o cookie |
| GET /api/workspace | Sessão; estado da loja e revisão |
| POST /api/workspace | Sessão, origem e CSRF; comando com id/type/payload |
| POST /api/upload | Sessão, origem e CSRF; PNG/JPEG/WebP até 3 MB |
| GET /api/upload?key=UUID.ext | Sessão; imagem com nome validado, sem cache |
| GET /api/health | Público; apenas ok/unavailable e status 200/503 |

Comandos comerciais: product, stock, price, rules, scenario, order, completeOrder, orderStatus, supplier, customer, purchase, receive, entry e settle. O cliente envia comandos, nunca um estado inteiro para sobrescrever. Idempotência é persistida com o hash do payload, além da transação e auditoria com usuário autenticado.

Códigos: 400 para validação comercial, 401 para sessão ausente/expirada, 403 para origem/CSRF, 413 para excesso de tamanho, 415 para tipo errado, 429 para limites de login, 500 para falhas internas e 503 para configuração/saúde indisponível.

Mercado Livre e Shopee continuam sem conectores implementados. A tela explica a utilidade e os requisitos de autorização; nenhuma credencial desses canais é solicitada. Emissão fiscal, webhooks e importação automática de pedidos não fazem parte desta entrega.
