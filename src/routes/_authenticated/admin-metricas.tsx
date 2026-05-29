import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, BarChart3, AlertTriangle, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-metricas")({
  component: AdminMetricas,
});

type AtrasoItem = {
  cliente_id: string;
  cliente_nome: string;
  fase: string;
  ordem: number;
  data_prevista: string | null;
  diasAtraso: number;
  responsaveis: string;
};


type OperacionalMember = { id?: string; name?: string };
type Cliente = {
  id: string; nome: string; categoria: string | null;
  operacional: OperacionalMember[] | null; removido_em: string | null;
};
type Step = {
  cliente_id: string; ordem: number; fase: string; status: string;
  data_prevista: string | null; data_concluida: string | null; created_at: string;
};

function AdminMetricas() {
  const { user } = useAuth();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: roleCheck, isLoading: roleLoading } = useQuery({
    enabled: !!user,
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).some((r) => r.role === "admin");
    },
  });

  const { data: clientes } = useQuery({
    enabled: !!roleCheck,
    queryKey: ["admin-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("id,nome,categoria,operacional,removido_em");
      if (error) throw error;
      return ((data ?? []) as Cliente[]).filter((c) => !c.removido_em && c.categoria === "ATIVO");
    },
  });

  const { data: steps, isLoading: stepsLoading } = useQuery({
    enabled: !!clientes && clientes.length > 0,
    queryKey: ["admin-steps", clientes?.length],
    queryFn: async () => {
      const ids = clientes!.map((c) => c.id);
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("cliente_id,ordem,fase,status,data_prevista,data_concluida,created_at")
        .in("cliente_id", ids);
      if (error) throw error;
      return (data ?? []) as Step[];
    },
  });

  const clienteById = useMemo(() => {
    const m = new Map<string, Cliente>();
    (clientes ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [clientes]);


  // Atrasados por colaborador
  const atrasadosPorColab = useMemo(() => {
    const map = new Map<string, { atrasados: number; clientes: Set<string> }>();
    (steps ?? []).forEach((s) => {
      if (s.status === "concluido") return;
      if (!s.data_prevista || s.data_prevista >= hoje) return;
      const cliente = clienteById.get(s.cliente_id);
      if (!cliente) return;
      const colabs = (cliente.operacional ?? []).map((m) => m?.name).filter(Boolean) as string[];
      const list = colabs.length > 0 ? colabs : ["(Sem responsável)"];
      list.forEach((nome) => {
        const cur = map.get(nome) ?? { atrasados: 0, clientes: new Set<string>() };
        cur.atrasados += 1;
        cur.clientes.add(s.cliente_id);
        map.set(nome, cur);
      });
    });
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, atrasados: v.atrasados, clientes: v.clientes.size }))
      .sort((a, b) => b.atrasados - a.atrasados);
  }, [steps, clienteById, hoje]);

  // Lista detalhada de steps atrasados (para drilldown)
  const atrasosDetalhe = useMemo<AtrasoItem[]>(() => {
    const out: AtrasoItem[] = [];
    (steps ?? []).forEach((s) => {
      if (s.status === "concluido") return;
      if (!s.data_prevista || s.data_prevista >= hoje) return;
      const cliente = clienteById.get(s.cliente_id);
      if (!cliente) return;
      const colabs = (cliente.operacional ?? []).map((m) => m?.name).filter(Boolean) as string[];
      const diasAtraso = Math.floor(
        (new Date(hoje).getTime() - new Date(s.data_prevista).getTime()) / 86400000,
      );
      out.push({
        cliente_id: s.cliente_id,
        cliente_nome: cliente.nome,
        fase: s.fase,
        ordem: s.ordem,
        data_prevista: s.data_prevista,
        diasAtraso,
        responsaveis: colabs.length > 0 ? colabs.join(", ") : "(Sem responsável)",
      });
    });
    return out.sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [steps, clienteById, hoje]);

  const [drilldown, setDrilldown] = useState<{ title: string; items: AtrasoItem[] } | null>(null);


  // Clientes por fase + tempo médio na fase
  const fasesStat = useMemo(() => {
    // Determina fase atual de cada cliente
    const clienteFase = new Map<string, { fase: string; desde: string }>();
    const stepsByCliente = new Map<string, Step[]>();
    (steps ?? []).forEach((s) => {
      const arr = stepsByCliente.get(s.cliente_id) ?? [];
      arr.push(s);
      stepsByCliente.set(s.cliente_id, arr);
    });
    stepsByCliente.forEach((arr, cid) => {
      arr.sort((a, b) => a.ordem - b.ordem);
      const atual = arr.find((s) => s.status !== "concluido");
      const ref = atual ?? arr[arr.length - 1];
      if (ref) {
        // "desde" = data_concluida do step anterior, ou created_at do step atual
        const idx = arr.indexOf(ref);
        const prev = idx > 0 ? arr[idx - 1] : null;
        const desde = prev?.data_concluida ?? ref.created_at;
        clienteFase.set(cid, { fase: ref.fase, desde });
      }
    });

    const agg = new Map<string, { count: number; totalDias: number }>();
    const agora = new Date();
    clienteFase.forEach(({ fase, desde }) => {
      const cur = agg.get(fase) ?? { count: 0, totalDias: 0 };
      cur.count += 1;
      const dias = Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 86400000));
      cur.totalDias += dias;
      agg.set(fase, cur);
    });
    return Array.from(agg.entries())
      .map(([fase, v]) => ({ fase, count: v.count, mediaDias: Math.round(v.totalDias / v.count) }))
      .sort((a, b) => a.fase.localeCompare(b.fase));
  }, [steps]);

  const totalAtrasados = atrasadosPorColab.reduce((acc, c) => acc + c.atrasados, 0);
  const totalClientesAtivos = clientes?.length ?? 0;

  if (roleLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!roleCheck) return <Navigate to="/" />;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" /> Métricas operacionais
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão admin · entregas, atrasos e ritmo dos colaboradores.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Users className="h-3 w-3" /> Clientes ativos
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold">{totalClientesAtivos}</p></CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onClick={() =>
            setDrilldown({ title: "Steps em atraso", items: atrasosDetalhe })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setDrilldown({ title: "Steps em atraso", items: atrasosDetalhe });
            }
          }}
          className="cursor-pointer transition-colors hover:bg-accent/40"
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> Steps em atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${totalAtrasados > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {totalAtrasados}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Clique para ver clientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" /> Colaboradores com pendência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{atrasadosPorColab.filter((c) => c.atrasados > 0).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Atrasados por colaborador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steps atrasados por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          {stepsLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : atrasadosPorColab.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              🎉 Nenhum step em atraso. Time on track!
            </p>
          ) : (
            <div className="space-y-2">
              {atrasadosPorColab.map((row) => {
                const max = atrasadosPorColab[0].atrasados || 1;
                const pct = Math.round((row.atrasados / max) * 100);
                return (
                  <div
                    key={row.nome}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setDrilldown({
                        title: `Atrasos · ${row.nome}`,
                        items: atrasosDetalhe.filter((a) =>
                          a.responsaveis.split(", ").includes(row.nome),
                        ),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDrilldown({
                          title: `Atrasos · ${row.nome}`,
                          items: atrasosDetalhe.filter((a) =>
                            a.responsaveis.split(", ").includes(row.nome),
                          ),
                        });
                      }
                    }}
                    className="cursor-pointer space-y-1 rounded-md p-2 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{row.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.clientes} cliente(s) ·{" "}
                        <Badge
                          variant="outline"
                          className={
                            row.atrasados > 5
                              ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }
                        >
                          {row.atrasados} atrasado(s)
                        </Badge>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${row.atrasados > 5 ? "bg-red-500" : "bg-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clientes por fase */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes por fase + tempo médio</CardTitle>
        </CardHeader>
        <CardContent>
          {fasesStat.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem dados de jornada ainda.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {fasesStat.map((f) => (
                <div key={f.fase} className="rounded-lg border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{f.fase}</p>
                  <p className="mt-2 text-2xl font-semibold">{f.count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    cliente(s) · {f.mediaDias} dia(s) em média
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
