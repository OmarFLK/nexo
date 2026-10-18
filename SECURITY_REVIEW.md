# Revisão de segurança — 18/10/2026

Escopo: código do Nexo e preparo para Vercel + Render + Neon. Não é uma certificação, um pentest independente nem garantia de ausência de vulnerabilidades. Não foram fornecidos projetos/domínios/credenciais dos provedores; configurações externas ainda precisam ser aplicadas e verificadas em homologação.

## Correções e proteções verificadas

| Área | Proteção no código | Evidência |
| --- | --- | --- |
| Autenticação | Scrypt com salt, comparação constante, sem conta/senha padrão no código | Teste de hash/login/reset |
| Sessões | Token aleatório de 256 bits, hash no banco, cookie HttpOnly/Secure/SameSite Strict, 12 h/30 min, revogação | Testes de rotação, logout, expiração, senha e mudança de e-mail |
| API | Login obrigatório em dados e fotos; validação por comando; dados financeiros inteiros; SQL parametrizado | Testes de API, estruturas inválidas e domínio |
| CSRF/origem | Origem exata e token vinculado à sessão; sem CORS aberto | Testes de origem/CSRF |
| Render direto | Chave privada de servidor injetada na Vercel e validada antes do login/API | Teste do gateway e teste funcional do proxy |
| Abuso | Janela persistida de login, limites de leitura/escrita/upload e hashing concorrente limitado | Testes de rate limit |
| XSS e navegador | React escapa texto; CSP com nonce aleatório por resposta e scripts sem unsafe-inline; iframe/objetos bloqueados; HSTS em produção | Headers de duas respostas e testes de navegador |
| Upload | Decodificação real, formato/MIME, 3 MB, 16 MP/6000 px, redução a 1600 px, WebP sem EXIF/GPS/payload anexado | Testes de imagem falsa, truncada, formato trocado e dimensão excessiva |
| Disco | UUID, criação exclusiva, permissões 0600, pasta privada, limite de 5000 fotos/256 MB e 20 envios/15 min | API, travessia de caminho, inspeção do código |
| Banco | TLS com validação de certificado, transação, idempotência, lock por loja, auditoria imutável | Testes SQLite/PostgreSQL/PGlite |
| Privilégios | Papel de runtime separado do proprietário; recusa contas excessivamente privilegiadas; migração fora do runtime | Teste com SET ROLE: operação permitida, administração/apagamento/DDL recusados |
| Segredos | Release por lista explícita, verificação de formatos de segredos, sem data/.env/fotos/histórico legado | `security:release` |
| Supply chain | Lockfile, npm audit, CI com token de leitura, ações fixadas por SHA e Dependabot semanal | Workflow e auditoria de dependências |

## Riscos residuais e ações obrigatórias

1. A senha anterior foi compartilhada no chat: troque-a antes de transferir a conta para produção. A conta local e o banco não são publicados no GitHub.
2. Ative 2FA nas quatro contas dos provedores e proteja a branch principal com revisão/CI no GitHub. O app ainda não tem MFA nativo nem recuperação por e-mail; Deployment Protection pode adicionar uma barreira.
3. Configure chave privada entre os serviços e papéis Neon restritos, sem permissões administrativas herdadas. O código recusa configurações inseguras, mas não cria nem administra suas contas externas.
4. Ative WAF/rate limit de borda. O orçamento global/de conta pode causar bloqueio temporário durante ataque; a aplicação não resolve ataques volumétricos.
5. Configure backup, retenção, restauração e alertas reais. O disco limita crescimento acidental, mas uploads órfãos ainda não possuem coleta automática; o limite não substitui monitoramento de disco.
6. Controle acesso e retenção de dados pessoais de clientes e fornecedores, incluindo backups e logs, conforme as obrigações da operação. Não foi feita uma auditoria jurídica/LGPD.
7. O PostgreSQL usa snapshot JSONB da única loja. Não há paginação: volume grande pode degradar memória/latência. Defina limites de operação e planeje normalização por agregados antes de ampliar a escala.
8. CSP mantém `style-src 'unsafe-inline'` por estilos dinâmicos da interface; scripts são protegidos por nonce. Há tolerâncias adicionais de desenvolvimento (eval/WebSocket/HTTP) que não devem ser usadas em produção.
9. Credenciais de migração têm acesso administrativo por necessidade de manutenção. Mantenha-as fora dos dois runtimes e de CI. O papel de runtime ainda tem acesso a dados comerciais e hashes necessários ao login; isso não torna um vazamento dessa credencial inofensivo.
10. Valide no domínio hospedado: TLS/pooling Neon, cookie no proxy real, headers, backup e sobrevivência das fotos após redeploy. Testes locais não comprovam essas configurações externas.

## Resultado operacional

O código inclui as proteções acima e testes automatizados. A liberação de produção depende de completar o guia DEPLOY.md e a homologação no ambiente real. Atualizações de dependências e monitoramento continuam necessários depois da publicação.

Fontes primárias: [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy), [OWASP — senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Neon — acesso](https://neon.com/docs/manage/database-access), [Render — discos](https://render.com/docs/disks), [Vercel — proteção](https://vercel.com/docs/deployment-protection).
