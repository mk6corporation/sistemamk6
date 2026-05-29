import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, TrendingUp, TrendingDown, Smile, Meh, Frown } from "lucide-react";
import { calcNps, classifyNps, type NpsResposta } from "@/lib/nps-utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/nps/")({
  component: NpsDashboard,
});

const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function NpsDashboard() {
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  const respostasQuery = useQuery({
    queryKey: ["nps-respostas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_nps")
        .select("*")
        .order("respondido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NpsResposta[];
    },
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes-nps-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome,plano");
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientesById = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; plano: string | null }>();
    for (const c of clientesQuery.data ?? []) m.set(c.id, c);
    return m;
  }, [clientesQuery.data]);

  const produtos = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientesQuery.data ?? []) {
      if (c.plano) set.add(c.plano);
    }
    return Array.from(set).sort();
  }, [clientesQuery.data]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of respostasQuery.data ?? []) {
      const d = new Date(r.respondido_em);
      set.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`);
    }
    return Array.from(set).sort().reverse();
  }, [respostasQuery.data]);

  const respostasFiltradas = useMemo(() => {
    return (respostasQuery.data ?? []).filter((r) => {
      if (filtroProduto !== "todos") {
        const c = clientesById.get(r.cliente_id);
        if (c?.plano !== filtroProduto) return false;
      }
      if (filtroMes !== "todos") {
        const d = new Date(r.respondido_em);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        if (key !== filtroMes) return false;
      }
      return true;
    });
  }, [respostasQuery.data, filtroProduto, filtroMes, clientesById]);

  const stats = useMemo(
    () => calcNps(respostasFiltradas.map((r) => r.score)),
    [respostasFiltradas],
  );

  const distribuicao = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) counts[i] = 0;
    for (const r of respostasFiltradas) counts[r.score] = (counts[r.score] ?? 0) + 1;
    return Object.entries(counts).map(([nota, qtd]) => ({
      nota,
      qtd,
      tipo: classifyNps(Number(nota)),
    }));
  }, [respostasFiltradas]);

  const evolucaoMensal = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const r of respostasQuery.data ?? []) {
      if (filtroProduto !== "todos") {
        const c = clientesById.get(r.cliente_id);
        if (c?.plano !== filtroProduto) continue;
      }
      const d = new Date(r.respondido_em);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const arr = buckets.get(key) ?? [];
      arr.push(r.score);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries())
      .sort()
      .slice(-12)
      .map(([key, scores]) => {
        const [y, m] = key.split("-").map(Number);
        const s = calcNps(scores);
        return { label: `${MESES_PT[m]}/${String(y).slice(2)}`, nps: s.nps, qtd: s.total };
      });
  }, [respostasQuery.data, filtroProduto, clientesById]);

  if (respostasQuery.isLoading || clientesQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">NPS — Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral das respostas de NPS dos seus clientes.
          </p>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Produto / Serviço:</span>
            <Select value={filtroProduto} onValueChange={setFiltroProduto}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os serviços</SelectItem>
                {produtos.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Mês:</span>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {mesesDisponiveis.map((k) => {
                  const [y, m] = k.split("-").map(Number);
                  return (
                    <SelectItem key={k} value={k}>{MESES_PT[m]} / {y}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {stats.total} resposta{stats.total === 1 ? "" : "s"}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="NPS"
            value={stats.nps}
            icon={Star}
            accent={stats.nps >= 50 ? "emerald" : stats.nps >= 0 ? "amber" : "red"}
            sub={stats.nps >= 50 ? "Excelente" : stats.nps >= 0 ? "Razoável" : "Crítico"}
          />
          <KpiCard label="Nota média" value={stats.media.toFixed(1)} icon={TrendingUp} accent="blue" />
          <KpiCard label="Respostas" value={stats.total} icon={Star} accent="violet" />
          <KpiCard label="Promotores" value={stats.promotores} icon={Smile} accent="emerald" />
          <KpiCard label="Neutros" value={stats.neutros} icon={Meh} accent="amber" />
          <KpiCard label="Detratores" value={stats.detratores} icon={Frown} accent="red" />
        </div>

        {/* Gráficos */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de notas</CardTitle>
              <CardDescription>Quantidade de respostas por nota (0–10).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribuicao}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="nota" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="qtd" radius={[4, 4, 0, 0]}>
                      {distribuicao.map((d) => (
                        <rect
                          key={d.nota}
                          fill={
                            d.tipo === "promotor" ? "#059669"
                              : d.tipo === "neutro" ? "#d97706"
                              : "#dc2626"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do NPS</CardTitle>
              <CardDescription>NPS mensal nos últimos 12 meses.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoMensal}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[-100, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="nps" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Últimas respostas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas respostas</CardTitle>
            <CardDescription>Respostas mais recentes (até 10).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {respostasFiltradas.slice(0, 10).map((r) => {
              const c = clientesById.get(r.cliente_id);
              const tipo = classifyNps(r.score);
              const cls =
                tipo === "promotor" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                  : tipo === "neutro" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                  : "bg-red-500/15 text-red-700 border-red-500/30";
              return (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cls}>NPS {r.score}</Badge>
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: r.cliente_id }}
                      className="font-medium hover:underline"
                    >
                      {c?.nome ?? "—"}
                    </Link>
                    <span className="text-xs text-muted-foreground">{c?.plano ?? ""}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.respondido_em).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {r.comentario && (
                    <p className="mt-2 text-sm text-muted-foreground">"{r.comentario}"</p>
                  )}
                </div>
              );
            })}
            {respostasFiltradas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma resposta no período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  icon: any;
  accent: "emerald" | "red" | "amber" | "blue" | "violet";
  sub?: string;
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    red: "text-red-600 bg-red-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    blue: "text-blue-600 bg-blue-500/10",
    violet: "text-violet-600 bg-violet-500/10",
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${colors[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="text-xl font-semibold tabular-nums">{value}</div>
            {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
