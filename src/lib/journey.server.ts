import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MK6_JOURNEY } from "./mk6-journey";

type StepRow = {
  id: string;
  cliente_id: string;
  ordem: number;
  status: string;
  data_prevista: string | null;
  tem_trava: boolean;
  cliente_entregue: boolean;
  bloqueado: boolean;
  acao_mk6_itens: Array<{ texto: string; concluido: boolean }> | null;
  pronto_para_avancar: boolean;
  atrasado: boolean;
};

/**
 * Recompute, para TODOS os clientes que têm timeline:
 *  - acao_mk6_itens (se vazio) preenchido a partir do template
 *  - bloqueado = true para steps depois do "step atual"
 *  - bloqueado = false para concluídos e para o step atual
 *  - pronto_para_avancar / atrasado calculados
 *  - clientes.step_atual_ordem atualizado
 *
 * Idempotente: pode rodar quantas vezes quiser.
 */
export async function migrarJourneyTodosClientes() {
  const { data: steps, error } = await supabaseAdmin
    .from("cliente_timeline_steps")
    .select(
      "id,cliente_id,ordem,status,data_prevista,tem_trava,cliente_entregue,bloqueado,acao_mk6_itens,pronto_para_avancar,atrasado",
    )
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (steps ?? []) as StepRow[];
  if (rows.length === 0) {
    return { clientes: 0, steps: 0, atualizacoes: 0 };
  }

  // agrupar por cliente
  const porCliente = new Map<string, StepRow[]>();
  for (const r of rows) {
    const arr = porCliente.get(r.cliente_id) ?? [];
    arr.push(r);
    porCliente.set(r.cliente_id, arr);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let atualizacoes = 0;

  for (const [clienteId, lista] of porCliente.entries()) {
    lista.sort((a, b) => a.ordem - b.ordem);

    // step atual = primeiro não-concluído
    const idxAtual = lista.findIndex((s) => s.status !== "concluido");
    const stepAtual = idxAtual >= 0 ? lista[idxAtual] : null;
    for (const s of lista) {
      const template = MK6_JOURNEY.find((t) => t.ordem === s.ordem);
      const patch: {
        acao_mk6_itens?: Array<{ texto: string; concluido: boolean }>;
        bloqueado?: boolean;
        pronto_para_avancar?: boolean;
        atrasado?: boolean;
      } = {};

      // 1) preencher acao_mk6_itens se vazio
      const itensAtuais = Array.isArray(s.acao_mk6_itens) ? s.acao_mk6_itens : [];
      if (itensAtuais.length === 0 && template) {
        patch.acao_mk6_itens = template.acao_mk6_itens.map((texto) => ({
          texto,
          concluido: s.status === "concluido",
        }));
      }

      // 2) bloqueado
      let novoBloqueado: boolean;
      if (s.status === "concluido") novoBloqueado = false;
      else if (stepAtual && s.ordem === stepAtual.ordem) novoBloqueado = false;
      else novoBloqueado = true;
      if (novoBloqueado !== s.bloqueado) patch.bloqueado = novoBloqueado;

      // 3) pronto_para_avancar (só faz sentido pro step atual)
      let pronto = false;
      if (stepAtual && s.id === stepAtual.id) {
        const itens = patch.acao_mk6_itens ?? itensAtuais;
        const acaoOk = itens.length === 0 || itens.every((i) => i.concluido);
        const clienteOk = !s.tem_trava || s.cliente_entregue;
        pronto = acaoOk && clienteOk;
      }
      if (pronto !== s.pronto_para_avancar) patch.pronto_para_avancar = pronto;

      // 4) atrasado
      const atrasado =
        s.status !== "concluido" &&
        !!s.data_prevista &&
        s.data_prevista < hoje;
      if (atrasado !== s.atrasado) patch.atrasado = atrasado;

      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabaseAdmin
          .from("cliente_timeline_steps")
          .update(patch)
          .eq("id", s.id);
        if (upErr) throw new Error(upErr.message);
        atualizacoes += 1;
      }
    }

    // atualizar ponteiro do cliente
    const { error: cliErr } = await supabaseAdmin
      .from("clientes")
      .update({ step_atual_ordem: stepAtualOrdem })
      .eq("id", clienteId);
    if (cliErr) throw new Error(cliErr.message);
  }

  return {
    clientes: porCliente.size,
    steps: rows.length,
    atualizacoes,
  };
}

/**
 * Avança o step atual de um cliente:
 *  - Marca step atual como concluido
 *  - Desbloqueia o próximo
 *  - Atualiza step_atual_ordem
 */
export async function avancarStepCliente(stepId: string) {
  const { data: step, error } = await supabaseAdmin
    .from("cliente_timeline_steps")
    .select(
      "id,cliente_id,ordem,status,tem_trava,cliente_entregue,acao_mk6_itens",
    )
    .eq("id", stepId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!step) throw new Error("Step não encontrado");
  if (step.status === "concluido") return { ok: true, jaConcluido: true };

  // validar pronto
  const itens = Array.isArray(step.acao_mk6_itens)
    ? (step.acao_mk6_itens as Array<{ concluido: boolean }>)
    : [];
  const acaoOk = itens.length === 0 || itens.every((i) => i.concluido);
  const clienteOk = !step.tem_trava || step.cliente_entregue;
  if (!acaoOk || !clienteOk) {
    throw new Error(
      "Step ainda não está pronto: conclua a Ação MK6 e marque a entrega do cliente (se houver trava).",
    );
  }

  // marcar concluido
  const { error: upErr } = await supabaseAdmin
    .from("cliente_timeline_steps")
    .update({
      status: "concluido",
      data_concluida: new Date().toISOString(),
      mk6_entregue: true,
      bloqueado: false,
      pronto_para_avancar: false,
    })
    .eq("id", stepId);
  if (upErr) throw new Error(upErr.message);

  // desbloquear próximo
  const { data: proximo } = await supabaseAdmin
    .from("cliente_timeline_steps")
    .select("id,ordem")
    .eq("cliente_id", step.cliente_id)
    .gt("ordem", step.ordem)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (proximo) {
    await supabaseAdmin
      .from("cliente_timeline_steps")
      .update({ bloqueado: false })
      .eq("id", proximo.id);

    await supabaseAdmin
      .from("clientes")
      .update({ step_atual_ordem: proximo.ordem })
      .eq("id", step.cliente_id);
  } else {
    // era o último (Step 15)
    await supabaseAdmin
      .from("clientes")
      .update({ step_atual_ordem: null })
      .eq("id", step.cliente_id);
  }

  return { ok: true, proximoOrdem: proximo?.ordem ?? null };
}
