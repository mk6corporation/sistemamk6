import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ESTAGIOS_ATIVO = new Set(["Venda Concluída","Contrato Assinado","Financeiro","Formulário de Cliente","Onboarding","Planejamento","1° REUNIÃO CS","Cliente","UPSELL","Aviso de Churn"]);
const ESTAGIOS_PAUSADO = new Set(["Pausado"]);
const ESTAGIOS_CHURN = new Set(["Churn"]);
const ESTAGIOS_FINALIZADO = new Set(["Projeto Finalizado (Não Churn)"]);
function classificarCategoria(estagio: string | null): string {
  if (!estagio) return "OUTRO";
  if (ESTAGIOS_ATIVO.has(estagio)) return "ATIVO";
  if (ESTAGIOS_PAUSADO.has(estagio)) return "PAUSADO";
  if (ESTAGIOS_CHURN.has(estagio)) return "CHURN";
  if (ESTAGIOS_FINALIZADO.has(estagio)) return "FINALIZADO";
  return "OUTRO";
}

const ClientePayload = z.object({
  id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(200),
  estagio: z.string().nullable().optional(),
  plano: z.string().nullable().optional(),
  inicio_contrato: z.string().nullable().optional(),
  fim_contrato: z.string().nullable().optional(),
  valor_mensal: z.number().nullable().optional(),
  orcamento_ads: z.number().nullable().optional(),
  satisfacao: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
  ultima_reuniao_gestor: z.string().nullable().optional(),
  ultima_otimizacao: z.string().nullable().optional(),
  feedback_data: z.string().nullable().optional(),
  data_reuniao_cs: z.string().nullable().optional(),
});

export type ClienteInput = z.infer<typeof ClientePayload>;

export const upsertClienteManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ClienteInput) => ClientePayload.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const categoria = classificarCategoria(data.estagio ?? null);
    const base = {
      nome: data.nome.trim(),
      estagio: data.estagio ?? null,
      categoria,
      plano: data.plano ?? null,
      inicio_contrato: data.inicio_contrato || null,
      fim_contrato: data.fim_contrato || null,
      valor_mensal: data.valor_mensal ?? null,
      orcamento_ads: data.orcamento_ads ?? null,
      satisfacao: data.satisfacao ?? null,
      observacao: data.observacao ?? null,
      ultima_reuniao_gestor: data.ultima_reuniao_gestor || null,
      ultima_otimizacao: data.ultima_otimizacao || null,
      feedback_data: data.feedback_data || null,
      data_reuniao_cs: data.data_reuniao_cs || null,
      updated_by: userId,
    };

    if (data.id) {
      // Atualização — busca estado anterior para detectar mudança de estágio
      const { data: anterior, error: prevErr } = await supabase
        .from("clientes")
        .select("estagio, categoria, nome")
        .eq("id", data.id)
        .maybeSingle();
      if (prevErr) throw new Error(prevErr.message);
      if (!anterior) throw new Error("Cliente não encontrado");

      const { error } = await supabase.from("clientes").update(base).eq("id", data.id);
      if (error) throw new Error(error.message);

      if (anterior.estagio !== base.estagio) {
        await supabase.from("mudancas_estagio").insert({
          cliente_id: data.id,
          notion_page_id: null,
          nome_cliente: base.nome,
          estagio_anterior: anterior.estagio,
          estagio_novo: base.estagio,
          categoria_anterior: anterior.categoria,
          categoria_nova: categoria,
          tipo_mudanca: "edicao_manual",
          notion_edited_at: null,
        });
      }
      return { id: data.id, novo: false };
    }

    // Criação manual
    const { data: created, error } = await supabase
      .from("clientes")
      .insert({ ...base, origem: "manual", notion_page_id: null, operacional: [] })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("mudancas_estagio").insert({
      cliente_id: created.id,
      notion_page_id: null,
      nome_cliente: base.nome,
      estagio_anterior: null,
      estagio_novo: base.estagio,
      categoria_anterior: null,
      categoria_nova: categoria,
      tipo_mudanca: "novo_cliente_manual",
      notion_edited_at: null,
    });

    return { id: created.id as string, novo: true };
  });

export const deleteClienteManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
