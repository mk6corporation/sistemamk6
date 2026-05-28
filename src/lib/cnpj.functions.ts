import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  enrichDadosCorporativosByCnpj,
  fetchBrasilApiCnpj,
  onlyDigits,
} from "./cnpj.server";

export const consultarCnpj = createServerFn({ method: "POST" })
  .inputValidator((input: { cnpj: string; clienteId?: string }) =>
    z
      .object({
        cnpj: z.string().min(11).max(20),
        clienteId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const d = onlyDigits(data.cnpj);
    if (d.length !== 14) {
      return { ok: false, error: "CNPJ inválido (precisa de 14 dígitos)" as string };
    }
    if (data.clienteId) {
      const r = await enrichDadosCorporativosByCnpj(data.clienteId, d);
      return r;
    }
    const raw = await fetchBrasilApiCnpj(d);
    if (!raw) return { ok: false, error: "CNPJ não encontrado na BrasilAPI" };
    return { ok: true, data: raw };
  });

export const enriquecerTodosCnpjs = createServerFn({ method: "POST" }).handler(
  async () => {
    const { data: rows, error } = await supabaseAdmin
      .from("dados_corporativos")
      .select("cliente_id, cnpj");
    if (error) throw new Error(error.message);

    let processados = 0;
    let preenchidos = 0;
    let semCnpj = 0;
    let invalidos = 0;
    let erros = 0;
    const detalhes: Array<{ cliente_id: string; filled: string[]; error?: string }> = [];

    for (const row of rows ?? []) {
      const cnpj = onlyDigits(row.cnpj);
      if (!cnpj) {
        semCnpj += 1;
        continue;
      }
      if (cnpj.length !== 14) {
        invalidos += 1;
        continue;
      }
      processados += 1;
      try {
        const r = await enrichDadosCorporativosByCnpj(row.cliente_id, cnpj);
        if (r.ok && r.filled.length > 0) {
          preenchidos += 1;
          detalhes.push({ cliente_id: row.cliente_id, filled: r.filled });
        } else if (!r.ok) {
          erros += 1;
          detalhes.push({ cliente_id: row.cliente_id, filled: [], error: r.error });
        }
      } catch (e: any) {
        erros += 1;
        detalhes.push({ cliente_id: row.cliente_id, filled: [], error: e?.message });
      }
      // BrasilAPI é gratuita mas tem rate limit; respiro de 250ms
      await new Promise((r) => setTimeout(r, 250));
    }

    return { processados, preenchidos, semCnpj, invalidos, erros, detalhes };
  },
);
