import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";
const DATABASE_ID = "27753569-e289-81a2-8ba7-f1fb21a982cd";

// Classificação dos estágios do "Status do Cliente" do Notion
const ESTAGIOS_ATIVO = new Set([
  "Contrato Assinado",
  "Financeiro",
  "Formulário de Cliente",
  "Onboarding",
  "Planejamento",
  "1° REUNIÃO CS",
  "Cliente",
  "UPSELL",
  "Aviso de Churn",
]);
const ESTAGIOS_PAUSADO = new Set(["Pausado"]);
const ESTAGIOS_CHURN = new Set(["Churn"]);
const ESTAGIOS_FINALIZADO = new Set(["Projeto Finalizado (Não Churn)"]);

export function classificarCategoria(estagio: string | null): string {
  if (!estagio) return "OUTRO";
  if (ESTAGIOS_ATIVO.has(estagio)) return "ATIVO";
  if (ESTAGIOS_PAUSADO.has(estagio)) return "PAUSADO";
  if (ESTAGIOS_CHURN.has(estagio)) return "CHURN";
  if (ESTAGIOS_FINALIZADO.has(estagio)) return "FINALIZADO";
  return "OUTRO";
}

function determinarTipoMudanca(
  categoriaAnterior: string | null,
  categoriaNova: string,
): string {
  if (!categoriaAnterior) return "novo_cliente";
  if (categoriaNova === "CHURN" && categoriaAnterior !== "CHURN") return "churn";
  if (categoriaNova === "PAUSADO" && categoriaAnterior !== "PAUSADO") return "pausou";
  if (categoriaNova === "FINALIZADO" && categoriaAnterior !== "FINALIZADO") return "finalizou";
  if (
    categoriaNova === "ATIVO" &&
    (categoriaAnterior === "PAUSADO" || categoriaAnterior === "CHURN")
  ) {
    return "recuperou";
  }
  return "mudanca_estagio";
}

type NotionPage = {
  id: string;
  last_edited_time: string;
  properties: Record<string, any>;
};

function extractTitle(prop: any): string {
  if (!prop?.title) return "";
  return prop.title.map((t: any) => t.plain_text ?? "").join("").trim();
}
function extractStatus(prop: any): string | null {
  return prop?.status?.name ?? null;
}
function extractSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}
function extractDate(prop: any): string | null {
  return prop?.date?.start ?? null;
}
function extractNumber(prop: any): number | null {
  return typeof prop?.number === "number" ? prop.number : null;
}
function extractPeople(prop: any): Array<{ id: string; name: string; avatar_url: string | null }> {
  if (!Array.isArray(prop?.people)) return [];
  return prop.people.map((p: any) => ({
    id: p.id,
    name: p.name ?? "",
    avatar_url: p.avatar_url ?? null,
  }));
}

async function fetchAllNotionPages(): Promise<NotionPage[]> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY não configurada (conexão Notion ausente)");

  const all: NotionPage[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${GATEWAY_URL}/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": NOTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        `Notion query falhou [${res.status}]: ${JSON.stringify(data).slice(0, 500)}`,
      );
    }

    all.push(...(data.results ?? []));
    hasMore = !!data.has_more;
    cursor = data.next_cursor ?? undefined;
  }
  return all;
}

export type SyncResult = {
  sync_run_id: string;
  status: "success" | "error";
  clientes_processados: number;
  clientes_novos: number;
  mudancas_detectadas: number;
  erro: string | null;
};

export async function runNotionSync(): Promise<SyncResult> {
  // Cria registro de sync_run
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error(`Erro criando sync_run: ${runErr?.message}`);
  const runId = runRow.id;

  let processados = 0;
  let novos = 0;
  let mudancas = 0;

  try {
    const pages = await fetchAllNotionPages();

    // Snapshot do estado atual no banco (para detectar diffs)
    const { data: snapshot, error: snapErr } = await supabaseAdmin
      .from("clientes")
      .select("id, notion_page_id, nome, estagio, categoria, removido_em");
    if (snapErr) throw new Error(`Erro lendo snapshot: ${snapErr.message}`);

    const snapshotMap = new Map(
      (snapshot ?? []).map((c) => [
        c.notion_page_id,
        {
          id: c.id as string,
          nome: c.nome as string,
          estagio: c.estagio as string | null,
          categoria: c.categoria as string | null,
          removido_em: c.removido_em as string | null,
        },
      ]),
    );

    const pageIdsNoNotion = new Set<string>();
    const mudancasParaInserir: any[] = [];
    const clientesUpsert: any[] = [];

    for (const page of pages) {
      const nome = extractTitle(page.properties["Cliente"]);
      if (!nome) continue; // ignora linhas vazias sem título

      pageIdsNoNotion.add(page.id);

      const estagio = extractStatus(page.properties["Status do Cliente"]);
      const categoria = classificarCategoria(estagio);
      const plano = extractSelect(page.properties["Plano"]);
      const operacional = extractPeople(page.properties["Operacional"]);
      const inicio_contrato = extractDate(page.properties["Início do Contrato"]);
      const valor_mensal = extractNumber(page.properties["Valor mensal do cliente"]);

      clientesUpsert.push({
        notion_page_id: page.id,
        nome,
        estagio,
        categoria,
        plano,
        operacional,
        inicio_contrato,
        valor_mensal,
        notion_last_edited_time: page.last_edited_time,
        last_synced_at: new Date().toISOString(),
        removido_em: null, // se reapareceu, "ressuscita"
      });

      const anterior = snapshotMap.get(page.id);
      if (!anterior) {
        // Cliente novo
        novos += 1;
        mudancasParaInserir.push({
          cliente_id: null,
          notion_page_id: page.id,
          nome_cliente: nome,
          estagio_anterior: null,
          estagio_novo: estagio,
          categoria_anterior: null,
          categoria_nova: categoria,
          tipo_mudanca: "novo_cliente",
          notion_edited_at: page.last_edited_time,
        });
      } else if (anterior.removido_em) {
        // Cliente que tinha sido removido reapareceu no Notion
        mudancasParaInserir.push({
          cliente_id: anterior.id,
          notion_page_id: page.id,
          nome_cliente: nome,
          estagio_anterior: anterior.estagio,
          estagio_novo: estagio,
          categoria_anterior: anterior.categoria,
          categoria_nova: categoria,
          tipo_mudanca: "restaurado_no_notion",
          notion_edited_at: page.last_edited_time,
        });
      } else if (anterior.estagio !== estagio) {
        // Mudança de estágio
        mudancasParaInserir.push({
          cliente_id: anterior.id,
          notion_page_id: page.id,
          nome_cliente: nome,
          estagio_anterior: anterior.estagio,
          estagio_novo: estagio,
          categoria_anterior: anterior.categoria,
          categoria_nova: categoria,
          tipo_mudanca: determinarTipoMudanca(anterior.categoria, categoria),
          notion_edited_at: page.last_edited_time,
        });
      }

      processados += 1;
    }

    // ===== Detectar exclusões (no banco mas não no Notion) =====
    const removidosAgora: Array<{ id: string; notion_page_id: string; nome: string; estagio: string | null; categoria: string | null }> = [];
    for (const [pageId, anterior] of snapshotMap) {
      if (pageIdsNoNotion.has(pageId)) continue;
      if (anterior.removido_em) continue; // já estava marcado
      removidosAgora.push({
        id: anterior.id,
        notion_page_id: pageId,
        nome: anterior.nome,
        estagio: anterior.estagio,
        categoria: anterior.categoria,
      });
    }

    // Upsert clientes
    if (clientesUpsert.length) {
      const { error: upErr } = await supabaseAdmin
        .from("clientes")
        .upsert(clientesUpsert, { onConflict: "notion_page_id" });
      if (upErr) throw new Error(`Erro upsert clientes: ${upErr.message}`);
    }

    // Preencher cliente_id para clientes novos
    if (mudancasParaInserir.some((m) => m.cliente_id === null)) {
      const idsNovos = mudancasParaInserir
        .filter((m) => m.cliente_id === null)
        .map((m) => m.notion_page_id);
      const { data: novosClientes } = await supabaseAdmin
        .from("clientes")
        .select("id, notion_page_id")
        .in("notion_page_id", idsNovos);
      const idMap = new Map((novosClientes ?? []).map((c) => [c.notion_page_id, c.id]));
      for (const m of mudancasParaInserir) {
        if (m.cliente_id === null) m.cliente_id = idMap.get(m.notion_page_id) ?? null;
      }
    }

    // Marcar removidos (soft-delete) e gerar evento
    if (removidosAgora.length) {
      const agora = new Date().toISOString();
      const { error: rmErr } = await supabaseAdmin
        .from("clientes")
        .update({ removido_em: agora })
        .in(
          "notion_page_id",
          removidosAgora.map((r) => r.notion_page_id),
        );
      if (rmErr) throw new Error(`Erro marcando removidos: ${rmErr.message}`);

      for (const r of removidosAgora) {
        mudancasParaInserir.push({
          cliente_id: r.id,
          notion_page_id: r.notion_page_id,
          nome_cliente: r.nome,
          estagio_anterior: r.estagio,
          estagio_novo: null,
          categoria_anterior: r.categoria,
          categoria_nova: null,
          tipo_mudanca: "removido_do_notion",
          notion_edited_at: null,
        });
      }
    }

    if (mudancasParaInserir.length) {
      const { error: mErr } = await supabaseAdmin
        .from("mudancas_estagio")
        .insert(mudancasParaInserir);
      if (mErr) throw new Error(`Erro insert mudancas: ${mErr.message}`);
      mudancas = mudancasParaInserir.length;
    }

    await supabaseAdmin
      .from("sync_runs")
      .update({
        status: "success",
        finalizado_em: new Date().toISOString(),
        clientes_processados: processados,
        clientes_novos: novos,
        mudancas_detectadas: mudancas,
      })
      .eq("id", runId);

    return {
      sync_run_id: runId,
      status: "success",
      clientes_processados: processados,
      clientes_novos: novos,
      mudancas_detectadas: mudancas,
      erro: null,
    };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await supabaseAdmin
      .from("sync_runs")
      .update({
        status: "error",
        finalizado_em: new Date().toISOString(),
        clientes_processados: processados,
        clientes_novos: novos,
        mudancas_detectadas: mudancas,
        erro: msg.slice(0, 1000),
      })
      .eq("id", runId);
    console.error("Notion sync failed:", e);
    return {
      sync_run_id: runId,
      status: "error",
      clientes_processados: processados,
      clientes_novos: novos,
      mudancas_detectadas: mudancas,
      erro: msg,
    };
  }
}
