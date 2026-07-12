# Plano Mestre da Migração SaaS: CantinaSmart POS

Este documento descreve as etapas de planejamento de arquitetura e evolução do **CantinaSmart POS** para se tornar uma plataforma definitiva de **SaaS Multiempresa (Multi-Tenant)**. 

---

## 1. Análise da Arquitetura Atual

A base do sistema já foi estruturada com prontidão para multiempresa (SaaS-Ready). A Etapa 5 consolidou os seguintes pontos:
- **TenantService**: Implementação de um resolvedor dinâmico de inquilino (`resolveCurrentTenantId`) baseado em parâmetros de URL, LocalStorage e atributos de usuário.
- **Transparência de Gravação**: Novas gravações (módulos de Produtos, Clientes, Vendas, Backups, Tickets, Usuários, Configurações, Logs, Notificações) passam automaticamente pela função `withTenant` ou recebem o `companyId` ativo na persistência.
- **Fallback Automático**: Leituras em tempo real de registros antigos sem `companyId` associam dinamicamente a empresa padrão (`default_udv_company`), mantendo a compatibilidade do banco de dados histórica de forma transparente e impedindo quebras ou perda de dados.
- **Camada de Serviço Centralizada**: Isolamento das rotinas do Firestore no `firebaseService.ts`, abstraindo a lógica do Firestore dos componentes visuais.

### Dependências Atuais de Empresa Única
Embora o banco de dados e os serviços de persistência já estejam preparados e gravando o `companyId`, o fluxo de execução atual e a interface do usuário operam sob um modelo conceitual de empresa única:
1. **Autenticação de Usuário**: O fluxo de login (`LoginView.tsx`) e a inicialização sincronizam todos os usuários globais da coleção `users`. Em um modelo multiempresa completo, o login deve buscar apenas usuários da empresa em questão, impedindo que usuários da Empresa A visualizem a lista ou tentem logar a partir do subdomínio/portal da Empresa B.
2. **Consultas Não Filtradas no Firestore**: Os listeners em tempo real (`onSnapshot`) em `firebaseService.ts` assinam as coleções globais completas (ex: `products`, `clients`) em vez de criar queries filtradas por `companyId`. Embora haja compatibilidade local, em produção isso causaria vazamento de dados confidenciais entre inquilinos.
3. **White Labeling Dinâmico**: Elementos estéticos como cores, logotipos e chaves de pagamento Pix estão fixos ou dependem da empresa padrão (`default_udv_company`). Devem ser extraídos dinamicamente da empresa ativa.

---

## 2. Plano Mestre de Evolução SaaS (Etapas Futuras)

A transição para multiempresa definitivo será realizada em 5 etapas incrementais detalhadas abaixo.

### Etapa 1: Isolamento de Consultas e Segurança no Firestore
- **Objetivo**: Garantir o isolamento lógico absoluto dos dados. Todas as consultas e inscrições em tempo real passadas ao Firestore devem conter filtros estritos de `where('companyId', '==', tenantId)`, e as regras do Firestore devem validar esse isolamento.
- **Arquivos Envolvidos**:
  - `/src/lib/firebaseService.ts` (modificação de `subscribeProducts`, `subscribeClients`, `subscribeTransactions`, etc.)
  - `/firestore.rules` (validação de propriedade lógica baseada no `companyId` do usuário autenticado)
- **Complexidade**: Média (requer a criação de índices compostos no Firestore para queries com filtros + ordenação).
- **Riscos**: Quebra de listagens na interface se os índices necessários do Firestore não forem criados ou se as queries tentarem acessar dados antigos sem o campo preenchido (mitigado pelo seeding automático da Etapa 5).
- **Forma de Teste**:
  - Logar com duas instâncias diferentes (simulando Tenants diferentes via parâmetro de URL `?tenantId=empresa_a` e `?tenantId=empresa_b`).
  - Monitorar as requisições de rede no console do desenvolvedor para assegurar que nenhum registro do Tenant A seja trafegado para o cliente do Tenant B.
- **Tempo Estimado**: 4 horas.

### Etapa 2: Autenticação Isolada por Tenant (Login Multi-SaaS)
- **Objetivo**: Isolar o processo de login para que um usuário digite suas credenciais sob o contexto do seu próprio tenant. Mapear o tenant dinamicamente antes do login (por exemplo, detectando o subdomínio ou exigindo o código da empresa).
- **Arquivos Envolvidos**:
  - `/src/components/LoginView.tsx` (exibição de logo e dados da empresa dinamicamente antes do login)
  - `/src/App.tsx` (gerenciamento do fluxo de sessão)
  - `/src/lib/firebaseService.ts` (funções de validação de credenciais)
- **Complexidade**: Alta.
- **Riscos**: Bloqueio de acesso para operadores legítimos se a resolução do tenant falhar devido a cache ou cookies expirados.
- **Forma de Teste**:
  - Acessar `http://localhost:3000/?companyId=cantina_unidade_sul` e verificar se a tela de login exibe a identidade da Unidade Sul e se somente aceita logins de usuários cadastrados naquela unidade.
- **Tempo Estimado**: 6 horas.

### Etapa 3: Painel de Gerenciamento de Tenants (SuperAdmin)
- **Objetivo**: Criar a interface de administração global do SaaS (SuperAdmin), permitindo criar novas empresas, visualizar estatísticas agregadas de uso, ativar ou suspender inquilinos e editar dados cadastrais de cobrança.
- **Arquivos Envolvidos**:
  - Novo `/src/components/SuperAdminPanel.tsx` (dashboard executivo global)
  - `/src/App.tsx` (roteamento para o painel SuperAdmin baseado na role do usuário)
  - `/src/lib/companyService.ts` (funções para gerenciar o ciclo de vida das empresas)
- **Complexidade**: Média.
- **Riscos**: Vazamento do acesso de nível SuperAdmin para administradores locais de cantinas.
- **Forma de Teste**:
  - Criar um usuário com role `superadmin` diretamente no Firestore.
  - Entrar no sistema com essa conta e testar a criação de um novo tenant completo ("UDV Cantina Oeste").
  - Logar no novo tenant e certificar que o ambiente está zerado e pronto para uso comercial.
- **Tempo Estimado**: 5 horas.

### Etapa 4: White Labeling Estético e Financeiro Dinâmico
- **Objetivo**: Ler dinamicamente a logo, a paleta de cores temática (CSS variables / Tailwind dinâmico) e a chave Pix configuradas no cadastro do tenant ativo, oferecendo uma experiência customizada para cada franquia ou cantina.
- **Arquivos Envolvidos**:
  - `/src/App.tsx` (aplicação dinâmica de temas no container raiz)
  - `/src/components/PDVTerminal.tsx` (leitura dinâmica da chave Pix e logotipos nos comprovantes)
  - `/src/components/DashboardView.tsx` (visualização de relatórios usando as cores institucionais do tenant)
- **Complexidade**: Baixa-Média.
- **Riscos**: Cores configuradas incorretamente por um administrador podem prejudicar a legibilidade da interface.
- **Forma de Teste**:
  - Alterar a cor temática da "Unidade Sul" de verde escuro para azul marinho nas configurações e verificar se toda a interface (botões, cabeçalhos, destaques) é renderizada em tons de azul instantaneamente.
- **Tempo Estimado**: 3 horas.

### Etapa 5: Consolidação de Cobranças e Limites (SaaS Monetization)
- **Objetivo**: Implementar bloqueios e regras de uso comercial com base no plano contratado por cada inquilino (ex: limite de cadastros de produtos, limite de usuários ativos, data de expiração da assinatura).
- **Arquivos Envolvidos**:
  - `/src/types.ts` (novos campos de plano e limites no tipo `Company`)
  - `/src/components/ProductManager.tsx` (bloqueio do botão de cadastro caso o limite do plano seja atingido)
  - `/src/components/UserManager.tsx` (limitação de novos operadores de caixa)
- **Complexidade**: Média.
- **Riscos**: Impedir operações legítimas de venda no PDV em caso de falha de validação dos limites de uso.
- **Forma de Teste**:
  - Configurar o limite de produtos do Tenant A para no máximo 10.
  - Tentar cadastrar o 11º produto e garantir que o sistema exiba uma mensagem amigável solicitando upgrade de plano, sem gerar erros de execução.
- **Tempo Estimado**: 4 horas.

---

## 3. Conclusão e Diretrizes de Engenharia

O projeto **CantinaSmart POS** concluiu com absoluto sucesso a transição de sua persistência de dados para uma estrutura SaaS-ready (Etapa 5). Atualmente, todas as gravações e leituras de dados contêm chaves de inquilino de forma implícita e transparente.

A próxima fase (Etapas 1 a 5 acima) elevará o software para um patamar comercial escalável, dividindo o esforço em ciclos seguros de desenvolvimento, permitindo que novas cantinas sejam embarcadas instantaneamente sem alterações no código fonte.
