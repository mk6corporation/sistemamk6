import { createFileRoute } from "@tanstack/react-router";

// Lista de tabelas operacionais (idem backup.functions.ts)
const TABELAS = [
  "clientes",
  "contratos",
  "dados_corporativos",
  "mudancas_estagio",
  "cliente_checkins",
  "cliente_nps",
  "cliente_performance",
  "cliente_timeline_steps",
  "comprovantes",
  "equipe_comercial_cliente",
  "nps_links",
  "profiles",
  "projecoes_cliente",
  "rotina_recorrente",
  "vendedor_links",
  "vendedor_motivos_perda_catalogo",
  "vendedor_profiles",
  "vendedor_registros_diarios",
  "user_roles",
] as const;

export const Route = createFileRoute("/api/public/hooks/backup-auto")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const arquivo: any = {
          versao: 1,
          gerado_em: new Date().toISOString(),
          contagem: {} as Record<string, number>,
          tabelas: {} as Record<string, any[]>,
        };

        for (const t of TABELAS) {
          const linhas: any[] = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabaseAdmin
              .from(t as any)
              .select("*")
              .range(from, from + pageSize - 1);
            if (error) {
              return new Response(`Erro lendo ${t}: ${error.message}`, { status: 500 });
            }
            if (!data || data.length === 0) break;
            linhas.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          arquivo.tabelas[t] = linhas;
          arquivo.contagem[t] = linhas.length;
        }

        const total = Object.values(arquivo.contagem).reduce(
          (a: number, b: any) => a + (b as number),
          0,
        );
        const dataStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const path = `auto/backup-${dataStr}.json`;
        const json = JSON.stringify(arquivo);

        const { error: upErr } = await supabaseAdmin.storage
          .from("backups")
          .upload(path, new Blob([json], { type: "application/json" }), {
            contentType: "application/json",
            upsert: true,
          });
        if (upErr) {
          return new Response(`Erro salvando backup: ${upErr.message}`, { status: 500 });
        }

        // Mantém apenas os últimos 30 backups automáticos
        const { data: arquivos } = await supabaseAdmin.storage
          .from("backups")
          .list("auto", { limit: 100, sortBy: { column: "name", order: "desc" } });
        if (arquivos && arquivos.length > 30) {
          const apagar = arquivos.slice(30).map((a) => `auto/${a.name}`);
          await supabaseAdmin.storage.from("backups").remove(apagar);
        }

        return new Response(
          JSON.stringify({ ok: true, path, total_registros: total }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
