# MK6 Client Hub — Documentação Técnica

Sistema interno da MK6 para gestão de clientes (agências de viagem), NPS, performance comercial e operação de vendedores. Centraliza dados do Notion, formulários financeiros e CNPJ público em uma única base.

> **Stack resumida:** TanStack Start v1 (SSR + server functions) · React 19 · Vite 7 · Tailwind CSS v4 · shadcn/ui · TanStack Query · Supabase (Postgres + Auth + Storage + Realtime + pg_cron) · Cloudflare Workers (edge runtime).

Índice:

1. [Visão geral](#1-visão-geral)
2. [Recursos e módulos](#2-recursos-e-módulos)
3. [Stack e tecnologia](#3-stack-e-tecnologia)
4. [Arquitetura](#4-arquitetura)
5. [Estrutura de pastas](#5-estrutura-de-pastas)
6. [Modelo de dados](#6-modelo-de-dados)
7. [Variáveis de ambiente e segredos](#7-variáveis-de-ambiente-e-segredos)
8. [Rodando localmente](#8-rodando-localmente)
9. [Build e deploy de produção](#9-build-e-deploy-de-produção)
10. [Integrações externas](#10-integrações-externas)
11. [Segurança](#11-segurança)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Visão geral

O MK6 Client Hub concentra:

- **CRM de clientes** (agências) com dados enriquecidos via BrasilAPI (CNPJ).
- **NPS** com formulários públicos, links por cliente e dashboard de respostas.
- **Painel de desempenho comercial** (funil de marketing/vendas, metas vs. realizado).
- **Portal de vendedores** (`/v/$slug`) onde vendedores externos registram métricas diárias que alimentam automaticamente o "Realizado" do funil.
- **Sincronização centralizada** com Notion (clientes + financeiro) executada via `pg_cron`.
- **Rotina recorrente** e **kanban operacional** para o time interno.

## 2. Recursos e módulos

| Módulo | Rota base | Descrição |
|---|---|---|
| Dashboard | `/` | Visão geral pós-login |
| Clientes | `/clientes`, `/clientes/$id` | CRM, contratos, check-ins, timeline, satisfação |
| Desempenho | `/desempenho`, `/desempenho/$id` | Funil comercial, metas vs realizado |
| NPS | `/nps`, `/nps/links`, `/nps/respostas`, `/nps/detratores` | Gestão de NPS, 9 perguntas obrigatórias |
| Formulário NPS público | `/nps/form/$slug` | Cliente final responde |
| Vendedores (interno) | `/vendedores` | Ranking global de vendedores |
| Portal Vendedor | `/v/$slug`, `/v/painel` | Cadastro/login e dashboard diário |
| Kanban / Feed / Rotina | `/kanban`, `/feed`, `/minha-rotina` | Operação interna |
| Admin | `/admin-metricas`, `/admin-renovacao` | Métricas e renovações |
| Webhooks públicos | `/api/public/hooks/*`, `/api/public/nps/submit` | Integração externa (HMAC) |

## 3. Stack e tecnologia

**Frontend**
- React 19 + TypeScript estrito
- TanStack Router (file-based) + TanStack Start v1 (SSR)
- TanStack Query 5 (cache de dados)
- Tailwind CSS v4 (via `@tailwindcss/vite`, tokens em `src/styles.css`)
- shadcn/ui (Radix UI primitives) + lucide-react
- react-hook-form + zod

**Backend (mesmo bundle)**
- `createServerFn` (TanStack Start) para RPC tipado
- Server routes (`src/routes/api/public/*`) para webhooks HTTP
- Cloudflare Workers (runtime edge) via `@cloudflare/vite-plugin` + `wrangler`

**Dados e infra**
- Supabase (Lovable Cloud): Postgres, Auth, Storage (`comprovantes`), Realtime, `pg_cron`
- RLS em todas as tabelas + funções `has_role` / `is_staff_user`
- Lovable AI Gateway (Gemini / GPT) — disponível via `LOVABLE_API_KEY`

## 4. Arquitetura

```text
                ┌────────────────────────┐
                │  Browser (React 19)    │
                │  TanStack Router/Query │
                └──────────┬─────────────┘
                           │ RPC (serverFn) / HTTP
                           ▼
        ┌──────────────────────────────────────┐
        │ Cloudflare Worker (TanStack Start)   │
        │ - SSR + hydration                    │
        │ - createServerFn handlers            │
        │ - /api/public/* (webhooks)           │
        └──────────┬───────────────────────────┘
                   │ supabase-js (anon+JWT) / service-role
                   ▼
        ┌──────────────────────────────────────┐
        │ Supabase (Postgres + Auth + Storage) │
        │ + pg_cron → /api/public/hooks/*      │
        └──────────┬───────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │ Notion API · BrasilAPI · Lovable AI │
        └─────────────────────────────────────┘
```

**Boundaries de execução:**
- Componentes/loaders: isomórficos. **Nunca** ler `process.env` aqui.
- `createServerFn(...).handler(...)`: servidor. Local correto para segredos.
- `src/routes/api/public/*`: HTTP puro, exige verificação HMAC para writes.

## 5. Estrutura de pastas

```text
.
├── docs/                          # ← esta documentação
├── public/                        # estáticos
├── src/
│   ├── routes/                    # file-based routing (TanStack)
│   │   ├── __root.tsx
│   │   ├── _authenticated.tsx     # gate de auth (staff)
│   │   ├── _authenticated/...     # páginas internas
│   │   ├── v.$slug.tsx            # portal vendedor (público)
│   │   ├── v.painel.tsx           # painel vendedor (auth)
│   │   ├── nps.form.$slug.tsx     # form NPS público
│   │   └── api/public/            # webhooks (HMAC)
│   ├── components/                # UI (shadcn + features)
│   ├── hooks/                     # use-auth, use-mobile
│   ├── lib/                       # *.functions.ts (serverFn) + *.server.ts
│   │   ├── notion-sync.server.ts
│   │   ├── notion-financeiro-sync.server.ts
│   │   ├── cnpj.functions.ts / .server.ts
│   │   ├── journey.functions.ts / .server.ts
│   │   ├── nps-utils.ts, vendedor-metrics.ts, format.ts
│   ├── integrations/supabase/     # client.ts, client.server.ts, auth-*
│   ├── styles.css                 # tokens Tailwind v4
│   ├── router.tsx, server.ts, start.ts
│   └── routeTree.gen.ts           # gerado — NÃO editar
├── supabase/
│   ├── config.toml                # NÃO editar project_id
│   └── migrations/                # SQL versionado
├── vite.config.ts
├── wrangler.jsonc                 # Cloudflare Worker config
├── package.json
└── .env                           # gerado pelo Lovable Cloud (não editar)
```

## 6. Modelo de dados

Principais tabelas (todas em `public` com RLS):

- **`clientes`** — agências (nome, slug, datas de contrato derivadas).
- **`dados_corporativos`** — payload BrasilAPI por CNPJ.
- **`contratos`** — N por cliente; trigger sincroniza datas no cliente.
- **`cliente_nps`** — respostas NPS (JSONB com 9 perguntas).
- **`nps_links`** — links públicos por cliente (slug).
- **`cliente_performance`** — funil mês/ano (marketing + vendas).
- **`mudancas_estagio`** — histórico do funil.
- **`vendedor_links`**, **`vendedor_profiles`**, **`vendedor_registros_diarios`**, **`vendedor_motivos_perda_catalogo`** — portal de vendedores.
- **`rotina_recorrente`**, **`sync_runs`**, **`financeiro_sync_erros`** — operação.
- **`profiles`**, **`user_roles`** (+ enum `app_role`) — usuários e permissões.

Funções: `has_role`, `is_staff_user`, `sync_cliente_contrato_datas`, `handle_new_user`, `touch_updated_at`.

## 7. Variáveis de ambiente e segredos

**Cliente (Vite, públicos)** — `.env` gerado automaticamente:
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

**Servidor (Worker, secretos)** — gerenciados via Lovable Cloud → Secrets:
```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY     # bypass RLS — só em código server
SUPABASE_DB_URL
NPS_WEBHOOK_SECRET            # HMAC do /api/public/hooks/nps
LOVABLE_API_KEY               # AI Gateway (gerenciado, use rotate)
NOTION_API_KEY                # via connector
```

> Nunca ler `process.env.*` fora de `.handler()` de um `createServerFn` ou de um handler `/api/public/*`. Em runtime Cloudflare a env só existe por request.

## 8. Rodando localmente

**Pré-requisitos:** Node 20+ (ou Bun), git.

```bash
# 1. Instalar deps
bun install      # ou: npm install

# 2. .env já vem preenchido pelo Lovable Cloud.
#    Se rodar fora do Lovable, criar .env com as VITE_* acima.

# 3. Dev server (Vite + SSR + HMR)
bun run dev      # http://localhost:8080
```

**Scripts (`package.json`):**

| Script | O que faz |
|---|---|
| `dev` | Vite dev server (SSR + HMR) |
| `build` | Build de produção (Cloudflare Worker) |
| `build:dev` | Build com modo dev (prerender + checagem) |
| `preview` | Sobe o bundle de produção localmente |
| `lint` | ESLint |
| `format` | Prettier |

**Banco local:** o projeto usa Supabase hospedado (Lovable Cloud). Para queries ad‑hoc use as ferramentas do painel ou `psql $SUPABASE_DB_URL` (somente leitura/insert por padrão).

**Migrações:** crie arquivos em `supabase/migrations/` via a ferramenta de migração do Lovable. Não rode `supabase db push` manualmente — o Lovable Cloud aplica automaticamente.

## 9. Build e deploy de produção

O deploy é gerenciado pelo Lovable:

1. Frontend e backend (Worker) sobem juntos no botão **Publish** no editor.
2. **Backend** (migrações, server functions, server routes) faz deploy automático em cada push.
3. **Frontend** exige clicar em "Update" no diálogo de Publish para promover.

URLs estáveis:
- Produção: `https://sistemamk6.lovable.app`
- Preview: `https://id-preview--<project-id>.lovable.app`
- Stable prod (para webhooks/cron): `https://project--<project-id>.lovable.app`

**Self-host (opcional):** ver `https://docs.lovable.dev/tips-tricks/self-hosting`. O bundle é um Cloudflare Worker (`wrangler.jsonc`), publicável com `wrangler deploy` após `bun run build`, desde que os secrets sejam recriados no destino.

## 10. Integrações externas

- **Notion** → `src/lib/notion-sync.server.ts` (clientes) e `notion-financeiro-sync.server.ts` (financeiro). Disparado por `pg_cron` chamando `/api/public/hooks/sync-all`.
- **BrasilAPI** → `src/lib/cnpj.server.ts` enriquece `dados_corporativos`.
- **NPS Webhook** → `POST /api/public/hooks/nps` (HMAC `NPS_WEBHOOK_SECRET`).
- **NPS Submit** → `POST /api/public/nps/submit` (público, validado por slug).
- **Lovable AI** → `LOVABLE_API_KEY` para Gemini/GPT (resumos de detratores etc).

## 11. Segurança

- RLS habilitado em todas as tabelas `public.*`.
- Papéis em tabela separada (`user_roles`) + `has_role()` `SECURITY DEFINER`.
- Staff (`is_staff_user()`) vs Vendedor externo (`vendedor_profiles`).
- Service role usado **apenas** em `client.server.ts` (server-only).
- Webhooks `/api/public/*` validam assinatura HMAC antes de qualquer write.
- Sessões em `localStorage` (Supabase Auth), JWT anexado automaticamente em serverFns via `attachSupabaseAuth`.

## 12. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `Unauthorized: No authorization header` em serverFn | `attachSupabaseAuth` não registrado | Conferir `src/start.ts` (`functionMiddleware`) |
| Build falha com "route not assignable" | String em `createFileRoute` divergente do nome do arquivo | Conferir convenção de pontos/`$param` |
| `process.env.X` undefined | Lido em escopo módulo/loader | Mover para dentro de `.handler()` |
| NPS aparece zerado com nota 7/8 | Comportamento correto: 7–8 = neutros | Adicionar promotores (9–10) para mover |
| Página em branco após navegação | Falta `<Outlet />` no layout | Verificar `_authenticated.tsx` / `__root.tsx` |
| Erro `[unenv] X not implemented` | Pacote Node-only no Worker | Trocar por alternativa edge/fetch |

---

Última atualização: 2026-06-03.
