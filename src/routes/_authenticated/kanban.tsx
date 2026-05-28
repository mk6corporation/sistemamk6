import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, KanbanSquare, ChevronRight, CheckCircle2, Flag, AlertTriangle, Clock, Hourglass,
} from "lucide-react";
import { MK6_JOURNEY } from "@/lib/mk6-journey";

export const Route = createFileRoute("/_authenticated/kanban")({
  component: KanbanPage,
});

function normalize(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

type OperacionalMember = { id?: string; name?: string };
type Cliente = {
  id: string; nome: string; categoria: string | null;
  operacional: OperacionalMember[] | null; removido_em: string | null;
  step_atual_ordem: number | null;
};
type Step = {
  id: string; cliente_id: string; ordem: number; fase: string; titulo: string;
  status: string; data_prevista: string | null;
  tem_trava: boolean; cliente_entregue: boolean;
  acao_mk6_itens: Array<{ texto: string; concluido: boolean }> | null;
  pronto_para_avancar: boolean; atrasado: boolean; bloqueado: boolean;
};

type RAG = "verde" | "amarelo" | "vermelho" | "pronto";

function ragOf(step: Step): RAG {
  if (step.atrasado) return "vermelho";
  if (step.pronto_para_avancar) return "pronto";
  const itens = Array.isArray(step.acao_mk6_itens) ? step.acao_mk6_itens : [];
  const acaoOk = itens.length === 0 || itens.every((i) => i.concluido);
  if (acaoOk && step.tem_trava && !step.cliente_entregue) return "amarelo";
  return "verde";
}

const RAG_STYLES: Record<RAG, { border: string; bg: string; chip: string; label: string; icon: any }> = {
  verde:    { border: "border-emerald-500/40", bg: "bg-emerald-500/5", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", label: "Ação MK6", icon: Clock },
  amarelo:  { border: "border-amber-500/40",   bg: "bg-amber-500/5",   chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", label: "Aguardando cliente", icon: Hourglass },
  vermelho: { border: "border-red-500/40",     bg: "bg-red-500/5",     chip: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", label: "Atrasado", icon: AlertTriangle },
  pronto:   { border: "border-primary/40",     bg: "bg-primary/5",     chip: "bg-primary/15 text-primary border-primary/30", label: "Pronto p/ avançar", icon: CheckCircle2 },
};

function KanbanPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"meus" | "todos">("meus");

  const { data: viewer } = useQuery({
    enabled: !!user,
    queryKey: ["viewer-kanban", user?.id],
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("nome").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      return {
        nome: profile?.nome ?? null,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  useEffect(() => { if (viewer?.isAdmin) setScope("todos"); }, [viewer?.isAdmin]);
  const effectiveScope: "meus" | "todos" = viewer?.isAdmin ? scope : "meus";

  const { data: clientes, isLoading: clientesLoading } = useQuery({
    queryKey: ["kanban-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome,categoria,operacional,removido_em,step_atual_ordem");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const filteredClientes = useMemo(() => {
    if (!viewer || !clientes) return [];
    const ativos = clientes.filter((c) => !c.removido_em && c.categoria === "ATIVO");
    if (effectiveScope === "todos") return ativos;
    const myName = normalize(viewer.nome);
    if (!myName) return [];
    return ativos.filter((c) =>
      (c.operacional ?? []).some((m) =>
        normalize(m?.name).includes(myName) || myName.includes(normalize(m?.name)),
      ),
    );
  }, [clientes, viewer, effectiveScope]);

  const clienteIds = filteredClientes.map((c) => c.id);

  const { data: steps, isLoading: stepsLoading } = useQuery({
    enabled: clienteIds.length > 0,
    queryKey: ["kanban-steps-v2", clienteIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("id,cliente_id,ordem,fase,titulo,status,data_prevista,tem_trava,cliente_entregue,acao_mk6_itens,pronto_para_avancar,atrasado,bloqueado")
        .in("cliente_id", clienteIds);
      if (error) throw error;
      return (data ?? []) as Step[];
    },
  });

  type Col = number | "sem-jornada" | "finalizado";
  const colunas = useMemo(() => {
    const map = new Map<Col, Array<{ cliente: Cliente; step?: Step; rag?: RAG }>>();
    for (let i = 1; i <= 15; i++) map.set(i, []);
    map.set("sem-jornada", []);
    map.set("finalizado", []);

    for (const c of filteredClientes) {
      const all = (steps ?? []).filter((s) => s.cliente_id === c.id);
      if (all.length === 0) { map.get("sem-jornada")!.push({ cliente: c }); continue; }
      const atual = all.find((s) => s.status !== "concluido");
      if (!atual) { map.get("finalizado")!.push({ cliente: c }); continue; }
      map.get(atual.ordem)!.push({ cliente: c, step: atual, rag: ragOf(atual) });
    }
    return map;
  }, [filteredClientes, steps]);

  const loading = clientesLoading || (clienteIds.length > 0 && stepsLoading);
  const colKeys: Col[] = ["sem-jornada", ...Array.from({ length: 15 }, (_, i) => i + 1), "finalizado"];

  const labelCol = (k: Col) => {
    if (k === "sem-jornada") return "Sem jornada";
    if (k === "finalizado") return "Finalizado";
    return `Step ${k}`;
  };
  const subCol = (k: Col) => {
    if (k === "sem-jornada") return "Aguardando aplicar MK6";
    if (k === "finalizado") return "Renovação / encerramento";
    const t = MK6_JOURNEY.find((j) => j.ordem === k);
    return t?.titulo ?? "";
  };
  const isMarco = (k: Col) => k === 9 || k === 15;

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <KanbanSquare className="h-6 w-6 text-primary" /> Jornada do Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Cada cliente aparece no <strong>step atual</strong> da MK6 Journey. RAG = verde (Ação MK6),
            amarelo (aguardando cliente), vermelho (atrasado), azul (pronto p/ avançar).
          </p>
        </div>
        {viewer?.isAdmin && (
          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs font-medium">
            <button type="button" onClick={() => setScope("meus")}
              className={`rounded px-3 py-1.5 ${effectiveScope === "meus" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              Meus clientes
            </button>
            <button type="button" onClick={() => setScope("todos")}
              className={`rounded px-3 py-1.5 ${effectiveScope === "todos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              Todos (admin)
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {colKeys.map((k) => {
            const items = colunas.get(k) ?? [];
            const marco = isMarco(k);
            return (
              <div key={String(k)} className="flex w-72 shrink-0 flex-col">
                <Card className={`flex h-full flex-col ${marco ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/30"}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        {marco && <Flag className="h-4 w-4 text-amber-600" />}
                        {labelCol(k)}
                      </span>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </CardTitle>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{subCol(k)}</p>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">—</p>
                    ) : (
                      items.map(({ cliente, step, rag }) => {
                        const st = rag ? RAG_STYLES[rag] : null;
                        const Icon = st?.icon;
                        return (
                          <Link
                            key={cliente.id}
                            to="/clientes/$clienteId"
                            params={{ clienteId: cliente.id }}
                            className={`block rounded-md border p-3 transition-colors hover:border-primary/40 hover:bg-accent ${st ? `${st.border} ${st.bg}` : "bg-card"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium">{cliente.nome}</p>
                              {k === "finalizado" ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                            </div>
                            {st && Icon && (
                              <Badge variant="outline" className={`mt-1.5 ${st.chip}`}>
                                <Icon className="mr-1 h-3 w-3" /> {st.label}
                              </Badge>
                            )}
                            {step?.data_prevista && (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                prev. {new Date(step.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
