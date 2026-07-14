import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============== MODELOS ==============
const ModeloInput = z.object({
  id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(200),
  descricao: z.string().nullable().optional(),
  corpo: z.string().default(""),
  ativo: z.boolean().default(true),
});
export type ModeloInput = z.infer<typeof ModeloInput>;

export const listModelos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contrato_modelos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ModeloInput) => ModeloInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      nome: data.nome.trim(),
      descricao: data.descricao ?? null,
      corpo: data.corpo ?? "",
      ativo: data.ativo,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("contrato_modelos").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("contrato_modelos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contrato_modelos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== CONTRATOS DOCUMENTOS ==============
const ContratoInput = z.object({
  id: z.string().uuid().nullable().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  modelo_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1).max(300),
  corpo: z.string().default(""),
  signatario_nome: z.string().nullable().optional(),
  signatario_email: z.string().email().nullable().optional().or(z.literal("")),
  signatario_documento: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  variaveis: z.record(z.string(), z.any()).nullable().optional(),
});
export type ContratoInput = z.infer<typeof ContratoInput>;

export const listContratos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contratos_documentos")
      .select("id, titulo, status, cliente_id, signatario_nome, signatario_email, enviado_em, assinado_em, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Busca nomes dos clientes
    const ids = Array.from(new Set((data ?? []).map((d) => d.cliente_id).filter(Boolean) as string[]));
    let nomeMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: cs } = await context.supabase.from("clientes").select("id, nome").in("id", ids);
      nomeMap = Object.fromEntries((cs ?? []).map((c) => [c.id, c.nome]));
    }
    return (data ?? []).map((d) => ({ ...d, cliente_nome: d.cliente_id ? nomeMap[d.cliente_id] ?? null : null }));
  });

export const getContrato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("contratos_documentos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Contrato não encontrado");

    let cliente_nome: string | null = null;
    if (doc.cliente_id) {
      const { data: c } = await context.supabase.from("clientes").select("nome").eq("id", doc.cliente_id).maybeSingle();
      cliente_nome = c?.nome ?? null;
    }

    const { data: assinaturas } = await context.supabase
      .from("contratos_assinaturas")
      .select("*")
      .eq("contrato_id", data.id)
      .order("created_at", { ascending: false });

    return { ...doc, cliente_nome, assinaturas: assinaturas ?? [] };
  });

export const upsertContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ContratoInput) => ContratoInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      cliente_id: data.cliente_id ?? null,
      modelo_id: data.modelo_id ?? null,
      titulo: data.titulo.trim(),
      corpo: data.corpo ?? "",
      signatario_nome: data.signatario_nome ?? null,
      signatario_email: data.signatario_email || null,
      signatario_documento: data.signatario_documento ?? null,
      observacoes: data.observacoes ?? null,
      variaveis: (data.variaveis ?? {}) as never,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("contratos_documentos").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("contratos_documentos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const enviarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // gera token e hash
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const { data: doc, error: e1 } = await context.supabase
      .from("contratos_documentos")
      .select("corpo")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!doc) throw new Error("Contrato não encontrado");

    const enc = new TextEncoder().encode(doc.corpo ?? "");
    const hashBuf = await crypto.subtle.digest("SHA-256", enc);
    const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await context.supabase
      .from("contratos_documentos")
      .update({ status: "enviado", token_publico: token, enviado_em: new Date().toISOString(), documento_hash: hash })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { token };
  });

export const cancelarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contratos_documentos")
      .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contratos_documentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
