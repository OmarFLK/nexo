# Política de segurança

Leia [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) para a revisão, evidências e riscos residuais, e [DEPLOY.md](./DEPLOY.md) para os passos obrigatórios antes da operação.

Não publique vulnerabilidades, dados de clientes, hashes, tokens, URLs privadas ou senhas em issues públicas. Use os recursos privados de reporte do GitHub se estiverem habilitados no repositório, ou contate o proprietário por canal privado. Não existe um e-mail público de segurança configurado.

A conta proprietária é provisionada por terminal, sem cadastro público. Senhas usam scrypt N=131072/r=8/p=1 com salt aleatório; tokens de sessão são armazenados como SHA-256. Cookies usam HttpOnly, SameSite=Strict e, em produção, Secure e prefixo __Host-. Sessões vencem em 12 horas ou 30 minutos sem atividade; troca de credencial/e-mail invalida a sessão.

Toda API comercial e foto exige sessão. Escritas exigem origem exata e CSRF; produção exige também a chave privada entre Vercel e Render. JSON tem limite de 64 KiB e tempo de envio; uploads de 3 MB são decodificados/regravados e protegidos por limites. Falhas internas não são expostas ao cliente. Eventos de login registram somente identificador derivado, horário e resultado, nunca senha/token.

O runtime PostgreSQL exige papel restrito e TLS com verificação de certificado. Migração e gestão da conta usam credencial administrativa fora do runtime. Auditoria, estoque e idempotência são transacionais. Dados pessoais, banco, arquivos .env e backups não entram na publicação Git.

Não há segurança perfeita ou configuração de produção automática. MFA das contas, WAF, retenção/backup, restauração testada, alertas, revisão de dependências e restrições de acesso dos provedores precisam ser mantidos pelo operador.
