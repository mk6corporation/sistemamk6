import { createFileRoute } from "@tanstack/react-router";
import { runNotionSync } from "@/lib/notion-sync.server";
import { syncFinanceiroFormAll } from "@/lib/notion-financeiro-sync.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrichDadosCorporativosByCnpj, onlyDigits } from "@/lib/cnpj.server";

/**
 * Endpoint público chamado pelo pg_cron para sincronização automática.
 * Roda Notion + Formulários + enriquecimento de CNPJ dos clientes novos.
 */
export const Route = createFileRoute("/api/public/hooks/sync-all")({
  server: {
    handlers: {
      POST: async () => {
        const started = new Date().toISOString();
        const notion = await runNotionSync().catch((e: any) => ({
          status: "error",
          erro: e?.message ?? String(e),
        }));

        const financeiro = await syncFinanceiroFormAll({ force: false }).catch((e: any) => ({
          erros: 1,
          erros_detalhe: [{ cliente: "(geral)", mensagem: e?.message ?? String(e) }],
        }));

        const { data: pendentes } = await supabaseAdmin
          .from("dados_corporativos")
          .select("cliente_id, cnpj, razao_social");

        let cnpjProcessados = 0;
        let cnpjPreenchidos = 0;
        let cnpjErros = 0;
        for (const row of pendentes ?? []) {
          if (row.razao_social && String(row.razao_social).trim()) continue;
          const cnpj = onlyDigits(row.cnpj);
          if (cnpj.length !== 14) continue;
          cnpjProcessados += 1;
          try {
            const r = await enrichDadosCorporativosByCnpj(row.cliente_id, cnpj);
            if (r.ok && r.filled.length > 0) cnpjPreenchidos += 1;
            else if (!r.ok) cnpjErros += 1;
          } catch {
            cnpjErros += 1;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        return new Response(
          JSON.stringify({
            ok: true,
            started,
            finalizado_em: new Date().toISOString(),
            notion,
            financeiro,
            cnpj: { processados: cnpjProcessados, preenchidos: cnpjPreenchidos, erros: cnpjErros },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
