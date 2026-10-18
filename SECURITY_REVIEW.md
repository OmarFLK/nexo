# Revisão de segurança — 18/10/2026

Escopo: código do Nexo e verificações controladas em `https://nexomktz.vercel.app`, com API no Render e PostgreSQL Neon. Não é uma certificação, um pentest independente nem garantia de ausência de vulnerabilidades. Os painéis privados dos provedores, backups, WAF, MFA e logs internos não foram auditados.

## Verificação do ambiente publicado — 18/10/2026

- 18 grupos de verificações HTTP passaram: disponibilidade sem modo de teste, CSP com nonce variável, ausência de cache em páginas e respostas privadas, redirecionamento de páginas privadas, recusa de APIs sem sessão ou com sessão forjada, recusa do acesso direto ao Render mesmo com cabeçalhos falsificados, origem estrangeira, arquivos sensíveis, tentativa de SQL injection no login, login válido, atributos do cookie, leitura autenticada, SSR, CSRF ausente/forjado, origem nula/ausente/antiga, JSON inválido/comando desconhecido/prototype pollution, caminho de foto inválido/upload falso, integridade dos registros e logout com revogação. Alguns desses itens compartilham o mesmo grupo.
- Navegador real: login e logout, navegação nas nove telas, largura de 390 px e 1440 px, cookie de sessão inacessível a JavaScript e ausência de exceções JavaScript. Na calculadora publicada, custo de R$ 100 e lucro de R$ 50 resultaram em R$ 150 de venda e 33,33% de margem; comissão de 10% resultou em R$ 166,67. Taxas de 100% produziram erro de cenário inviável.
- TLS 1.3 com certificados válidos observado nas conexões de teste à Vercel, Render e Neon. A conexão Neon foi feita pelo mesmo módulo de banco da aplicação, usando o papel restrito configurado; não é uma captura da conexão interna do processo Render.
- O papel Neon testado não pode atualizar usuários, criar objetos no esquema público nem apagar auditoria. A verificação de privilégios do runtime passou sem alterar o banco.
- Sete bundles JavaScript públicos referenciados pelo login foram examinados: não continham a chave privada do proxy, a conexão Neon testada ou hashes de senha. O source map consultado foi bloqueado com HTTP 403. Não se trata de uma varredura de todos os arquivos ou de todo o histórico do GitHub.
- Os registros comerciais, incluindo revisão do workspace, permaneceram idênticos antes e depois das verificações HTTP. Foram criadas e encerradas somente sessões de teste; contadores de proteção e logs de segurança são efeitos esperados dos testes.
- Testes locais: 31 testes automatizados e checagem de tipos passaram; fluxos de API e navegador executados em banco temporário. Cadastro/edição de produtos e preços, estoque, venda, devolução, compra/recebimento/custo médio, clientes, fornecedores, lançamentos/liquidação, taxas e cenários foram verificados sem gravar transações comerciais em produção. A suíte também verifica concorrência e repetição de comandos, upload privado, payload excessivo e estruturas inválidas.
- `npm audit` não identificou vulnerabilidades conhecidas nas dependências instaladas na data da execução. Isso não exclui falhas desconhecidas ou vulnerabilidades de configuração.

### Criptografia e limites observados

HTTPS/TLS protege o tráfego. As senhas são armazenadas com scrypt e salt, e os tokens de sessão são guardados no banco somente como hash. Hash de senha é intencionalmente não reversível; não deve ser substituído por criptografia reversível. O código usa TLS com validação de certificado para o Neon. Segundo a documentação do provedor, os dados em repouso no Neon usam AES-256: [segurança do Neon](https://neon.com/docs/security/security-overview).

Não foi adicionada uma segunda camada de criptografia ao JSONB nesta revisão: ela exigiria migração de dados, gestão independente de chaves, rotação e restauração testada. A criptografia de disco do provedor não impede a leitura por uma credencial SQL autorizada. Fotos têm acesso autenticado e armazenamento privado, mas não possuem criptografia própria da aplicação. Dados exibidos ao proprietário autenticado necessariamente chegam ao seu navegador; não podem ser ocultados desse próprio usuário por criptografia.

### Pendências prioritárias

1. **Senha do app:** a senha compartilhada anteriormente no chat foi aceita no login real durante o teste. Troque por uma senha exclusiva. A revisão não mudou a senha nem encerrou sessões de outros dispositivos.
2. **Credencial administrativa Neon:** uma conexão administrativa foi compartilhada anteriormente. Se ainda não foi rotacionada, redefina a senha desse papel no Neon e atualize somente os locais de manutenção que a utilizam. Não substituir `DATABASE_URL` do runtime pela conexão administrativa. Sua rotação não foi confirmada nesta revisão.
3. **Fotos:** o filesystem padrão do Render gratuito é temporário. Fotos podem desaparecer em reinício/redeploy; configure armazenamento durável antes de depender delas. A revisão não comprova persistência após redeploy. [Limites do Render gratuito](https://render.com/docs/free#free-web-services).
4. **Contas e operação:** habilite MFA nos provedores, configure proteção de borda e alertas, separe previews de produção e teste a restauração de backups. Essas configurações não são verificáveis somente pelo site público. O aplicativo continua sem MFA nativo, e os limites de login podem bloquear temporariamente o proprietário quando alguém tenta abusar da conta.

Resultados detalhados sem conteúdo comercial ficam localmente em `.sites-runtime/production-security-results.json`, `.sites-runtime/production-browser-results.json` e `.sites-runtime/production-storage-results.json`. Essa pasta é ignorada pelo Git; não publique arquivos de configuração ou credenciais que também ficam nela.

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
