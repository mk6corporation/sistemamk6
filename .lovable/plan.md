## O que vou construir

Um portal separado onde os vendedores dos seus clientes criam acesso por meio de um link único, registram suas métricas diárias e alimentam automaticamente o "Realizado" do funil comercial daquele cliente.

---

### 1. Banco de dados (1 migração)

- **`vendedor_links`**: 1 link por cliente (slug único + ativo/inativo). Você gera/copia o link em uma nova tela.
- **`vendedor_profiles`**: vincula o `user_id` do vendedor ao `cliente_id` (criado no cadastro via slug). Guarda nome, telefone, status.
- **`vendedor_registros_diarios`**: 1 linha por vendedor por dia, com colunas:
  - `leads_recebidos`, `ligacoes`, `follow_ups`, `cotacoes_enviadas`, `vendas_fechadas`, `faturamento_bruto`
  - `motivos_perda` (jsonb: `[{motivo, quantidade}]`)
- **`vendedor_motivos_perda_catalogo`**: lista pré-definida ("Preço", "Prazo", "Concorrente fechou", "Sem retorno", "Não tem perfil", "Outros") + opção do vendedor adicionar livre.
- RLS: vendedor só vê/edita os próprios registros; equipe interna vê tudo.

### 2. Rotas novas

**Públicas (vendedor):**
- `/v/$slug` → tela de cadastro/login (cria conta vinculada ao cliente do slug automaticamente).
- `/v/painel` (autenticado como vendedor) → dashboard do vendedor com:
  - Formulário do dia (com auto-save) — campos acima + motivos de perda.
  - Cards visuais: Hoje, Semana, Quinzena, Mês com ligações, leads, follow-ups, cotações, vendas, faturamento bruto/líquido, ticket médio (calculado).
  - Histórico de dias preenchidos (editável).

**Internas (você):**
- `/clientes/$clienteId/vendedores` → gerenciar o link, ver lista de vendedores cadastrados, ranking individual (dia/semana/quinzena/mês), comparativo entre eles.
- `/vendedores` (menu lateral, dentro de Operacional) → ranking global de todos os vendedores de todos os clientes, com filtros.

### 3. Integração automática com o funil comercial

- O componente `PerformanceFunil` passa a ler o "Realizado" do mês corrente como **soma agregada** dos `vendedor_registros_diarios` de todos os vendedores daquele cliente no mês selecionado.
- Quando houver dados de vendedores no mês, o card "Realizado" mostra um selo "Auto via vendedores" e os campos ficam read-only (com botão "Editar manualmente" como override).
- Quando não houver, mantém o preenchimento manual atual.
- Marketing (parte de cima) continua manual pelo seu time.

### 4. Design

- Dashboard do vendedor: layout limpo, gradiente suave, cards grandes com ícones e números destacados, gráficos de barra simples para evolução diária. Paleta atual do projeto.
- Tela de cadastro pelo link: hero com o nome do cliente, campo de nome do vendedor + email + senha.

### Detalhes técnicos

- Auth: Supabase signup email/senha. O slug do link é validado server-side via `createServerFn` que cria a linha em `vendedor_profiles` vinculando ao cliente correto (não confio em payload do client).
- Agregação do funil: server function que faz `sum()` por cliente/ano/mês na tabela diária.
- Motivos de perda: catálogo seedado na migração; vendedor escolhe da lista ou digita "Outros".
- Sem alteração nas funcionalidades existentes além de injetar a fonte de dados auto no Realizado.

Posso seguir?