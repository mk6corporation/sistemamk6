import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tabelas operacionais (exclui sync_runs e financeiro_sync_erros — metadados de sync legado)
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

export type BackupArquivo = {
  versao: 1;
  gerado_em: string;
  contagem: Record<string, number>;
  tabelas: Record<string, any[]>;
};

async function ensureAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito: apenas administradores.");
}

export const gerarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const arquivo: BackupArquivo = {
      versao: 1,
      gerado_em: new Date().toISOString(),
      contagem: {},
      tabelas: {},
    };

    for (const t of TABELAS) {
      const linhas: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from(t as any)
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) throw new Error(`Erro lendo ${t}: ${error.message}`);
        if (!data || data.length === 0) break;
        linhas.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      arquivo.tabelas[t] = linhas;
      arquivo.contagem[t] = linhas.length;
    }

    return arquivo;
  });

const RestaurarInput = z.object({
  arquivo: z.object({
    versao: z.literal(1),
    gerado_em: z.string(),
    contagem: z.record(z.string(), z.number()).optional(),
    tabelas: z.record(z.string(), z.array(z.any())),
  }),
  modo: z.enum(["upsert", "substituir"]).default("upsert"),
});

export const restaurarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RestaurarInput>) => RestaurarInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const resultado: Record<string, { inseridos: number; erro?: string }> = {};

    // Em modo "substituir", limpa tabelas em ordem reversa para respeitar FKs
    if (data.modo === "substituir") {
      for (const t of [...TABELAS].reverse()) {
        if (t === "profiles" || t === "user_roles") continue; // não apaga usuários
        const { error } = await supabaseAdmin.from(t as any).delete().not("id", "is", null);
        if (error) {
          resultado[t] = { inseridos: 0, erro: `limpeza: ${error.message}` };
        }
      }
    }

    for (const t of TABELAS) {
      const linhas = data.arquivo.tabelas[t];
      if (!Array.isArray(linhas) || linhas.length === 0) {
        resultado[t] = { inseridos: 0 };
        continue;
      }
      // Insere em lotes de 500
      let inseridos = 0;
      try {
        for (let i = 0; i < linhas.length; i += 500) {
          const lote = linhas.slice(i, i + 500);
          const { error } = await supabaseAdmin
            .from(t as any)
            .upsert(lote, { onConflict: "id" });
          if (error) throw error;
          inseridos += lote.length;
        }
        resultado[t] = { inseridos };
      } catch (e: any) {
        resultado[t] = { inseridos, erro: e?.message ?? String(e) };
      }
    }

    return { restaurado_em: new Date().toISOString(), resultado };
  });
