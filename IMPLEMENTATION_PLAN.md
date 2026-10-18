# Estado da implementação

- [x] Interface móvel simples, marca Nexo, estoque e produtos na mesma área.
- [x] Precificação livre por custo e lucro desejado, venda em faixa amarela e formulário com largura completa.
- [x] Backend de vendas, reservas, devoluções, compras, custo médio e financeiro.
- [x] Login, conta proprietária, senha com hash, sessão, logout, CSRF e limite de tentativas.
- [x] SQLite para desenvolvimento e PostgreSQL com transações para Neon.
- [x] Importação inicial que preserva conta e dados sem sobrescrever destino existente.
- [x] Arquivos de publicação para Vercel/Render e instruções de variáveis, disco e backup.
- [x] Testes de domínio, persistência, autenticação, SQL PostgreSQL e API.
- [ ] Conectar e validar as URLs reais de Vercel/Render e DATABASE_URL do Neon.
- [ ] Importar a conta para Neon e executar a homologação no ambiente hospedado.
- [ ] Configurar retenção e testar restauração de banco e fotos nos serviços reais.

Fora desta etapa: múltiplos usuários/perfis, MFA, recuperação por e-mail, emissão fiscal, conectores de marketplace, paginação e relatórios de grande volume.
