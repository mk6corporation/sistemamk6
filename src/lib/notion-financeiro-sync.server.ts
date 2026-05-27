import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";

function headers() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY não configurada");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": NOTION_API_KEY,
    "Content-Type": "application/json",
  };
}

async function notionGet(path: string) {
  const res = await fetch(`${GATEWAY_URL}${path}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion GET ${path} [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function notionPost(path: string, body: unknown) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion POST ${path} [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

// Encontra o child_database do "Financeiro / Formulário do Financeiro"
// percorrendo os toggles da página do cliente
async function descobrirFinanceiroDatabaseId(notionPageId: string): Promise<string | null> {
  const top = await notionGet(`/blocks/${notionPageId}/children?page_size=100`);
  for (const block of top.results ?? []) {
    if (block.type === "child_database" && /financeiro/i.test(block.child_database?.title ?? "")) {
      return block.id;
    }
    if (block.type === "heading_2" && block.has_children) {
      const heading = block.heading_2?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      if (/financeiro/i.test(heading)) {
        const children = await notionGet(`/blocks/${block.id}/children?page_size=100`);
        for (const child of children.results ?? []) {
          if (child.type === "child_database") return child.id;
        }
      }
    }
  }
  return null;
}

function rt(prop: any): string | null {
  if (!Array.isArray(prop?.rich_text) || prop.rich_text.length === 0) return null;
  const v = prop.rich_text.map((t: any) => t.plain_text ?? "").join("").trim();
  return v || null;
}
function title(prop: any): string | null {
  if (!Array.isArray(prop?.title) || prop.title.length === 0) return null;
  const v = prop.title.map((t: any) => t.plain_text ?? "").join("").trim();
  return v || null;
}
function multi(prop: any): string | null {
  if (!Array.isArray(prop?.multi_select) || prop.multi_select.length === 0) return null;
  return prop.multi_select.map((s: any) => s?.name).filter(Boolean).join(", ");
}
function parseNumero(s: string | null): number | null {
  if (!s) return null;
  // Extrai o primeiro número do texto (lida com "R$1.500 E O RESTANTE EM 6 BOLETOS")
  // Aceita formatos: "R$ 1.500,00" / "9000" / "1.234,56" / "4.182"
  const m = s.match(/-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const raw = m[0];
  // Se tem ambos . e , — assume . = milhar, , = decimal (BR)
  let clean = raw;
  if (raw.includes(".") && raw.includes(",")) {
    clean = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    // só vírgula = decimal BR
    clean = raw.replace(",", ".");
  } else if (raw.includes(".")) {
    // só ponto: se 3 dígitos após = separador de milhar, senão decimal
    const after = raw.split(".").pop() ?? "";
    if (after.length === 3) clean = raw.replace(/\./g, "");
  }
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

// Converte "90 DIAS", "12 MESES", "1 ANO", "1 ano e meio" → número de meses
function parseVigenciaMeses(s: string | null): number | null {
  if (!s) return null;
  const txt = s.toLowerCase();
  const m = txt.match(/(\d+(?:[.,]\d+)?)\s*(dia|mes|mês|ano)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  const unit = m[2];
  if (unit.startsWith("dia")) return num / 30;
  if (unit.startsWith("mes") || unit.startsWith("mês")) return num;
  if (unit.startsWith("ano")) return num * 12;
  return null;
}

function addMonths(dateISO: string, meses: number): string {
  const d = new Date(dateISO);
  const totalDays = Math.round(meses * 30);
  d.setDate(d.getDate() + totalDays);
  return d.toISOString().slice(0, 10);
}

// Procura uma chave em properties ignorando maiúsculas, espaços extras e ":"
function findKey(props: Record<string, any>, ...needles: string[]): any {
  const norm = (s: string) => s.toLowerCase().replace(/[\s:?.]+/g, "");
  const targets = needles.map(norm);
  for (const [k, v] of Object.entries(props)) {
    if (targets.some((t) => norm(k).includes(t))) return v;
  }
  return undefined;
}

export type FinanceiroSyncStats = {
  clientes_tentados: number;
  clientes_com_formulario: number;
  clientes_sem_formulario: number;
  erros: number;
  erros_detalhe: { cliente: string; mensagem: string; etapa: string }[];
};

export async function syncFinanceiroFormAll(opts?: { force?: boolean }): Promise<FinanceiroSyncStats> {
  const stats: FinanceiroSyncStats = {
    erros_detalhe: [],
    clientes_tentados: 0,
    clientes_com_formulario: 0,
    clientes_sem_formulario: 0,
    erros: 0,
  };

  const query = supabaseAdmin
    .from("clientes")
    .select("id, notion_page_id, nome, financeiro_form_database_id, financeiro_form_synced_at")
    .is("removido_em", null);

  const { data: clientes, error } = await query;
  if (error) throw new Error(`Erro lendo clientes: ${error.message}`);

  for (const cliente of clientes ?? []) {
    stats.clientes_tentados += 1;

    // Se já sincronizou e não é forçado, pula
    if (!opts?.force && cliente.financeiro_form_synced_at) {
      stats.clientes_com_formulario += 1;
      continue;
    }

    try {
      let dbId = cliente.financeiro_form_database_id;
      if (!dbId) {
        dbId = await descobrirFinanceiroDatabaseId(cliente.notion_page_id);
        if (!dbId) {
          stats.clientes_sem_formulario += 1;
          continue;
        }
        await supabaseAdmin
          .from("clientes")
          .update({ financeiro_form_database_id: dbId })
          .eq("id", cliente.id);
      }

      const q = await notionPost(`/databases/${dbId}/query`, { page_size: 1 });
      const page = q.results?.[0];
      if (!page) {
        stats.clientes_sem_formulario += 1;
        continue;
      }
      const props = page.properties ?? {};

      const nomeEmpresa = title(findKey(props, "nomedaempresa", "razaosocial")) ?? cliente.nome;
      const cnpj = rt(findKey(props, "cnpj"));
      const endereco = rt(findKey(props, "endereco"));
      const banco = multi(findKey(props, "bancoouinstituicao", "banco"));
      const formaPag = rt(findKey(props, "formadepagamento"));
      const vigencia = rt(findKey(props, "vigenciadoservico", "vigencia"));
      const valorTotalRaw = rt(findKey(props, "valortotaldocontrato", "valortotaldoco"));
      const valorRecebidoRaw = rt(findKey(props, "valortotalrecebido", "valortotalrecebid"));
      const valorTotal = parseNumero(valorTotalRaw);
      const valorRecebido = parseNumero(valorRecebidoRaw);
      const produtoVendido = multi(findKey(props, "produtovendido"));
      const linkContrato = findKey(props, "linkdocontrato", "linkdocontratdocliente")?.url ?? null;
      const horarioEnvio: string | null =
        findKey(props, "horariodoenvio", "horariodoenv")?.created_time ?? null;
      const participante = findKey(props, "participante")?.created_by ?? null;
      const grupoNome = rt(findKey(props, "nomadogrupocriado", "nomedogrupocriado", "grupocriado"));

      // 1) dados_corporativos (1 por cliente)
      await supabaseAdmin
        .from("dados_corporativos")
        .upsert(
          {
            cliente_id: cliente.id,
            razao_social: nomeEmpresa,
            nome_fantasia: nomeEmpresa,
            cnpj,
            endereco,
          },
          { onConflict: "cliente_id" },
        );

      // 2) contrato base (1 por cliente+tipo)
      await supabaseAdmin
        .from("contratos")
        .upsert(
          {
            cliente_id: cliente.id,
            tipo: "base" as const,
            produto_contratado: produtoVendido,
            banco_recebimento: banco,
            forma_pagamento: formaPag,
            valor_total: valorTotal,
            valor_recebido: valorRecebido,
            inicio_contrato: horarioEnvio ? horarioEnvio.slice(0, 10) : null,
            observacoes: [
              vigencia ? `Vigência: ${vigencia}` : null,
              linkContrato ? `Contrato: ${linkContrato}` : null,
              grupoNome ? `Grupo: ${grupoNome}` : null,
            ]
              .filter(Boolean)
              .join("\n") || null,
          },
          { onConflict: "cliente_id,tipo" },
        );

      // 3) equipe comercial (vendedor = quem preencheu o formulário)
      if (participante?.name || horarioEnvio) {
        await supabaseAdmin
          .from("equipe_comercial_cliente")
          .upsert(
            {
              cliente_id: cliente.id,
              vendedor_nome: participante?.name ?? null,
              data_venda: horarioEnvio ? horarioEnvio.slice(0, 10) : null,
            },
            { onConflict: "cliente_id" },
          );
      }

      await supabaseAdmin
        .from("clientes")
        .update({ financeiro_form_synced_at: new Date().toISOString() })
        .eq("id", cliente.id);

      stats.clientes_com_formulario += 1;
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      console.error(`[financeiro-sync] cliente ${cliente.nome}:`, e);
      stats.erros += 1;
      stats.erros_detalhe.push({ cliente: cliente.nome, mensagem, etapa: "sync" });
      await supabaseAdmin.from("financeiro_sync_erros").insert({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        mensagem: mensagem.slice(0, 1000),
        etapa: "sync",
      });
    }
  }

  return stats;
}
