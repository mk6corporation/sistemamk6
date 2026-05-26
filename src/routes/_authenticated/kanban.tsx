import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, KanbanSquare, ChevronRight, CheckCircle2 } from "lucide-react";

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
};
type Step = {
  cliente_id: string; ordem: number; semana: number | null;
  fase: string; titulo: string; status: string; data_prevista: string | null;
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
        .select("id,nome,categoria,operacional,removido_em");
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
    queryKey: ["kanban-steps", clienteIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("cliente_id,ordem,semana,fase,titulo,status,data_prevista")
        .in("cliente_id", clienteIds)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Step[];
    },
  });

  // Para cada cliente, achar o "step atual" (primeiro não-concluído) → semana
  const colunas = useMemo(() => {
    const map = new Map<number | "sem-jornada" | "finalizado", { cliente: Cliente; step?: Step }[]>();
    for (let i = 1; i <= 13; i++) map.set(i, []);
    map.set("sem-jornada", []);
    map.set("finalizado", []);

    for (const c of filteredClientes) {
      const allSteps = (steps ?? []).filter((s) => s.cliente_id === c.id);
      if (allSteps.length === 0) {
        map.get("sem-jornada")!.push({ cliente: c });
        continue;
      }
      const ativo = allSteps.find((s) => s.status !== "concluido");
      if (!ativo) {
        map.get("finalizado")!.push({ cliente: c });
        continue;
      }
      const semana = ativo.semana ?? 1;
      const arr = map.get(semana) ?? map.set(semana, []).get(semana)!;
      arr.push({ cliente: c, step: ativo });
    }
    return map;
  }, [filteredClientes, steps]);

  const loading = clientesLoading || (clienteIds.length > 0 && stepsLoading);

  const colKeys: Array<number | "sem-jornada" | "finalizado"> = [
    "sem-jornada", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, "finalizado",
  ];

  const labelCol = (k: number | "sem-jornada" | "finalizado") => {
    if (k === "sem-jornada") return "Sem jornada";
    if (k === "finalizado") return "Finalizado";
    return `Sprint ${k}`;
  };
  const subCol = (k: number | "sem-jornada" | "finalizado") => {
    if (k === "sem-jornada") return "Aguardando aplicar MK6";
    if (k === "finalizado") return "Renovação / encerramento";
    return `Semana ${k} da jornada`;
  };

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <KanbanSquare className="h-6 w-6 text-primary" /> Jornada do Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o progresso dos clientes em cada sprint da MK6 Journey.
          </p>
        </div>
        {viewer?.isAdmin && (
          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setScope("meus")}
              className={`rounded px-3 py-1.5 ${effectiveScope === "meus" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >Meus clientes</button>
            <button
              type="button"
              onClick={() => setScope("todos")}
              className={`rounded px-3 py-1.5 ${effectiveScope === "todos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >Todos (admin)</button>
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
            return (
              <div key={String(k)} className="flex w-72 shrink-0 flex-col">
                <Card className="flex h-full flex-col bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{labelCol(k)}</span>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{subCol(k)}</p>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        Nenhum cliente
                      </p>
                    ) : (
                      items.map(({ cliente, step }) => (
                        <Link
                          key={cliente.id}
                          to="/clientes/$clienteId"
                          params={{ clienteId: cliente.id }}
                          className="block rounded-md border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{cliente.nome}</p>
                            {k === "finalizado" ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                          </div>
                          {step && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {step.titulo}
                            </p>
                          )}
                          {step?.data_prevista && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              prev. {new Date(step.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </Link>
                      ))
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
