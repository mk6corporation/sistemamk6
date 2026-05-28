import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BrasilApiCnpj = {
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  ddd_telefone_1?: string | null;
  email?: string | null;
};

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function formatCnpj(d: string): string {
  const x = onlyDigits(d).padStart(14, "0").slice(0, 14);
  return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12, 14)}`;
}

function formatCep(d: string | null | undefined): string | null {
  const x = onlyDigits(d);
  if (x.length !== 8) return d ?? null;
  return `${x.slice(0, 5)}-${x.slice(5)}`;
}

function formatTelefone(d: string | null | undefined): string | null {
  const x = onlyDigits(d);
  if (!x) return null;
  if (x.length === 11) return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`;
  if (x.length === 10) return `(${x.slice(0, 2)}) ${x.slice(2, 6)}-${x.slice(6)}`;
  return d ?? null;
}

export async function fetchBrasilApiCnpj(cnpj: string): Promise<BrasilApiCnpj | null> {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return null;
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
  if (!res.ok) return null;
  return (await res.json()) as BrasilApiCnpj;
}

/**
 * Atualiza dados_corporativos do cliente preenchendo SOMENTE campos vazios
 * (null/string vazia). Retorna a lista de campos preenchidos.
 */
export async function enrichDadosCorporativosByCnpj(
  clienteId: string,
  cnpjRaw: string,
): Promise<{ ok: boolean; filled: string[]; error?: string }> {
  const cnpjDigits = onlyDigits(cnpjRaw);
  if (cnpjDigits.length !== 14) return { ok: false, filled: [], error: "CNPJ inválido" };

  const data = await fetchBrasilApiCnpj(cnpjDigits);
  if (!data) return { ok: false, filled: [], error: "CNPJ não encontrado na BrasilAPI" };

  const { data: current, error: selErr } = await supabaseAdmin
    .from("dados_corporativos")
    .select("*")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (selErr) return { ok: false, filled: [], error: selErr.message };

  const endereco = [data.logradouro, data.numero, data.complemento]
    .filter((p) => p && String(p).trim())
    .join(", ");
  const cidadeUf = [data.municipio, data.uf].filter(Boolean).join(" / ");

  const candidates: Record<string, string | null> = {
    cnpj: formatCnpj(cnpjDigits),
    razao_social: data.razao_social ?? null,
    nome_fantasia: data.nome_fantasia || data.razao_social || null,
    endereco: endereco || null,
    bairro: data.bairro ?? null,
    cidade_uf: cidadeUf || null,
    cep: formatCep(data.cep),
    telefone: formatTelefone(data.ddd_telefone_1),
    email_comercial: data.email ?? null,
  };

  const patch: Record<string, string> = {};
  const filled: string[] = [];
  for (const [k, v] of Object.entries(candidates)) {
    if (!v) continue;
    const cur = current ? (current as any)[k] : null;
    if (cur == null || String(cur).trim() === "") {
      patch[k] = v;
      filled.push(k);
    }
  }

  if (Object.keys(patch).length === 0) return { ok: true, filled: [] };

  if (current) {
    const { error } = await supabaseAdmin
      .from("dados_corporativos")
      .update(patch)
      .eq("cliente_id", clienteId);
    if (error) return { ok: false, filled: [], error: error.message };
  } else {
    const { error } = await supabaseAdmin
      .from("dados_corporativos")
      .insert({ cliente_id: clienteId, ...patch });
    if (error) return { ok: false, filled: [], error: error.message };
  }

  return { ok: true, filled };
}
