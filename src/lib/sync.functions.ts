import { createServerFn } from "@tanstack/react-start";
import { runNotionSync } from "./notion-sync.server";
import { syncFinanceiroFormAll } from "./notion-financeiro-sync.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrichDadosCorporativosByCnpj, onlyDigits } from "./cnpj.server";

export const triggerNotionSync = createServerFn({ method: "POST" }).handler(async () => {
  return runNotionSync();
});

export const triggerFinanceiroSync = createServerFn({ method: "POST" })
  .inputValidator((input: { force?: boolean } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    return syncFinanceiroFormAll({ force: data.force });
  });

/**
 * Sincroniza tudo de uma vez:
 * 1) Notion (clientes/estágios)
 * 2) Formulários do financeiro (CNPJ, contratos)
 * 3) Enriquece via BrasilAPI apenas clientes sem razão social (novos)
 */
export const syncTudo = createServerFn({ method: "POST" }).handler(async () => {
  const notion = await runNotionSync().catch((e: any) => ({
    status: "error",
    erro: e?.message ?? String(e),
  }));

  const financeiro = await syncFinanceiroFormAll({ force: false }).catch((e: any) => ({
    erros: 1,
    erros_detalhe: [{ cliente: "(geral)", mensagem: e?.message ?? String(e) }],
  }));

  // Enriquecimento CNPJ apenas para clientes ainda não preenchidos
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

  return {
    finalizado_em: new Date().toISOString(),
    notion,
    financeiro,
    cnpj: { processados: cnpjProcessados, preenchidos: cnpjPreenchidos, erros: cnpjErros },
  };
});
