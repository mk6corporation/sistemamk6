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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, TrendingUp, Smile, Meh, Frown, Award } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/nps/")({
  component: NpsDashboard,
});

const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// Paleta vibrante
const COLOR_PROMOTOR = "#10b981"; // emerald-500
const COLOR_NEUTRO = "#f59e0b"; // amber-500
const COLOR_DETRATOR = "#ef4444"; // red-500
const COLOR_LINE = "#6366f1"; // indigo-500
const COLOR_SERVICE_POS = "#10b981";
const COLOR_SERVICE_NEU = "#f59e0b";
const COLOR_SERVICE_NEG = "#ef4444";

// Faixas Bain & Co
function classificarBain(nps: number): {
  label: string;
  color: string;
  bg: string;
  hex: string;
} {
  if (nps >= 75)
    return {
      label: "Excelência",
      color: "text-emerald-700",
      bg: "bg-emerald-500/15 border-emerald-500/40",
      hex: "#10b981",
    };
  if (nps >= 50)
    return {
      label: "Qualidade",
      color: "text-blue-700",
      bg: "bg-blue-500/15 border-blue-500/40",
      hex: "#3b82f6",
    };
  if (nps >= 1)
    return {
      label: "Aperfeiçoamento",
      color: "text-amber-700",
      bg: "bg-amber-500/15 border-amber-500/40",
      hex: "#f59e0b",
    };
  return {
    label: "Crítica",
    color: "text-red-700",
    bg: "bg-red-500/15 border-red-500/40",
    hex: "#ef4444",
  };
}

function NpsDashboard() {
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [drilldown, setDrilldown] = useState<{
    title: string;
    description?: string;
    respostas: NpsResposta[];
  } | null>(null);

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

  const bain = classificarBain(stats.nps);

  // Clientes únicos respondentes + a tratar (detratores únicos)
  const clientesStats = useMemo(() => {
    const unicos = new Set<string>();
    const aTratar = new Set<string>();
    for (const r of respostasFiltradas) {
      unicos.add(r.cliente_id);
      if (r.score <= 6) aTratar.add(r.cliente_id);
    }
    return { unicos: unicos.size, aTratar: aTratar.size };
  }, [respostasFiltradas]);

  // Distribuição donut
  const distribuicaoDonut = useMemo(
    () => [
      { name: "Promotores", value: stats.promotores, color: COLOR_PROMOTOR },
      { name: "Neutros", value: stats.neutros, color: COLOR_NEUTRO },
      { name: "Detratores", value: stats.detratores, color: COLOR_DETRATOR },
    ],
    [stats],
  );

  // NPS por serviço (plano)
  const npsPorServico = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const r of respostasFiltradas) {
      const c = clientesById.get(r.cliente_id);
      const plano = c?.plano ?? "Sem plano";
      const arr = buckets.get(plano) ?? [];
      arr.push(r.score);
      buckets.set(plano, arr);
    }
    return Array.from(buckets.entries())
      .map(([plano, scores]) => {
        const s = calcNps(scores);
        const color =
          s.nps >= 50 ? COLOR_SERVICE_POS : s.nps >= 0 ? COLOR_SERVICE_NEU : COLOR_SERVICE_NEG;
        return { plano, nps: s.nps, qtd: s.total, color };
      })
      .sort((a, b) => b.nps - a.nps);
  }, [respostasFiltradas, clientesById]);

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

        {/* KPIs com cores */}
        {/* KPIs com cores */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <KpiCard
            label="NPS"
            value={stats.nps}
            icon={Star}
            accent={
              stats.nps >= 75 ? "emerald"
              : stats.nps >= 50 ? "blue"
              : stats.nps >= 1 ? "amber"
              : "red"
            }
            sub={bain.label}
            highlight
            onClick={() =>
              setDrilldown({
                title: `Todas as respostas — ${bain.label}`,
                description: `NPS ${stats.nps} • ${stats.total} respostas`,
                respostas: respostasFiltradas,
              })
            }
          />
          <KpiCard
            label="Nota média"
            value={stats.media.toFixed(1)}
            icon={TrendingUp}
            accent="indigo"
            onClick={() =>
              setDrilldown({
                title: "Todas as respostas",
                description: `Nota média ${stats.media.toFixed(1)}`,
                respostas: respostasFiltradas,
              })
            }
          />
          <KpiCard
            label="Respostas"
            value={stats.total}
            icon={Star}
            accent="violet"
            onClick={() =>
              setDrilldown({
                title: "Todas as respostas",
                description: `${stats.total} respostas no período`,
                respostas: respostasFiltradas,
              })
            }
          />
          <KpiCard
            label="Promotores"
            value={stats.promotores}
            icon={Smile}
            accent="emerald"
            onClick={() =>
              setDrilldown({
                title: "Promotores (notas 9–10)",
                description: `${stats.promotores} respostas`,
                respostas: respostasFiltradas.filter((r) => r.score >= 9),
              })
            }
          />
          <KpiCard
            label="Neutros"
            value={stats.neutros}
            icon={Meh}
            accent="amber"
            onClick={() =>
              setDrilldown({
                title: "Neutros (notas 7–8)",
                description: `${stats.neutros} respostas`,
                respostas: respostasFiltradas.filter((r) => r.score >= 7 && r.score <= 8),
              })
            }
          />
          <KpiCard
            label="Detratores"
            value={stats.detratores}
            icon={Frown}
            accent="red"
            onClick={() =>
              setDrilldown({
                title: "Detratores (notas 0–6)",
                description: `${stats.detratores} respostas`,
                respostas: respostasFiltradas.filter((r) => r.score <= 6),
              })
            }
          />
          <KpiCard
            label="A tratar"
            value={clientesStats.aTratar}
            icon={Award}
            accent="pink"
            sub={`${clientesStats.unicos} clientes`}
            onClick={() => {
              const ids = new Set<string>();
              const lista: NpsResposta[] = [];
              for (const r of respostasFiltradas) {
                if (r.score <= 6 && !ids.has(r.cliente_id)) {
                  ids.add(r.cliente_id);
                  lista.push(r);
                }
              }
              setDrilldown({
                title: "Clientes a tratar",
                description: `${ids.size} clientes detratores únicos`,
                respostas: lista,
              });
            }}
          />
        </div>


        {/* Faixas Bain */}
        <Card className="border-l-4" style={{ borderLeftColor: bain.hex }}>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Faixas NPS (Bain & Co):</span>
            </div>
            <FaixaPill color="#10b981" label="Excelência ≥ 75" active={stats.nps >= 75} />
            <FaixaPill color="#3b82f6" label="Qualidade 50–74" active={stats.nps >= 50 && stats.nps < 75} />
            <FaixaPill color="#f59e0b" label="Aperfeiçoamento 1–49" active={stats.nps >= 1 && stats.nps < 50} />
            <FaixaPill color="#ef4444" label="Crítica ≤ 0" active={stats.nps <= 0} />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Classificação atual:</span>
              <Badge variant="outline" className={`${bain.bg} ${bain.color} font-semibold`}>
                {bain.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos principais */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de respostas</CardTitle>
              <CardDescription>Promotores, neutros e detratores.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                    <Pie
                      data={distribuicaoDonut}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      stroke="none"
                      onClick={(slice: any) => {
                        const name = slice?.name as string;
                        const filtro =
                          name === "Promotores"
                            ? (r: NpsResposta) => r.score >= 9
                            : name === "Neutros"
                            ? (r: NpsResposta) => r.score >= 7 && r.score <= 8
                            : (r: NpsResposta) => r.score <= 6;
                        setDrilldown({
                          title: name,
                          description: `${respostasFiltradas.filter(filtro).length} respostas`,
                          respostas: respostasFiltradas.filter(filtro),
                        });
                      }}
                      className="cursor-pointer"
                    >
                      {distribuicaoDonut.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* NPS por serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NPS por serviço</CardTitle>
              <CardDescription>Pontuação por produto/plano.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {npsPorServico.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem dados no período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={npsPorServico} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="plano"
                        tick={{ fontSize: 11 }}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 12 }} domain={[-100, 100]} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number, _name, p: any) => [
                          `NPS ${value} (${p.payload.qtd} resp.)`,
                          p.payload.plano,
                        ]}
                      />
                      <Bar dataKey="nps" radius={[6, 6, 0, 0]}>
                        {npsPorServico.map((d) => (
                          <Cell key={d.plano} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por nota */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de notas</CardTitle>
              <CardDescription>Quantidade de respostas por nota (0–10).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      const counts: Record<number, number> = {};
                      for (let i = 0; i <= 10; i++) counts[i] = 0;
                      for (const r of respostasFiltradas)
                        counts[r.score] = (counts[r.score] ?? 0) + 1;
                      return Object.entries(counts).map(([nota, qtd]) => ({
                        nota,
                        qtd,
                        color:
                          classifyNps(Number(nota)) === "promotor"
                            ? COLOR_PROMOTOR
                            : classifyNps(Number(nota)) === "neutro"
                            ? COLOR_NEUTRO
                            : COLOR_DETRATOR,
                      }));
                    })()}
                  >
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
                    <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                      {(() => {
                        const counts: Record<number, number> = {};
                        for (let i = 0; i <= 10; i++) counts[i] = 0;
                        for (const r of respostasFiltradas)
                          counts[r.score] = (counts[r.score] ?? 0) + 1;
                        return Object.entries(counts).map(([nota]) => (
                          <Cell
                            key={nota}
                            fill={
                              classifyNps(Number(nota)) === "promotor"
                                ? COLOR_PROMOTOR
                                : classifyNps(Number(nota)) === "neutro"
                                ? COLOR_NEUTRO
                                : COLOR_DETRATOR
                            }
                          />
                        ));
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Evolução */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do NPS por mês</CardTitle>
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
                    <Line
                      type="monotone"
                      dataKey="nps"
                      stroke={COLOR_LINE}
                      strokeWidth={3}
                      dot={{ r: 4, fill: COLOR_LINE }}
                      activeDot={{ r: 6 }}
                    />
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
                tipo === "promotor" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40"
                  : tipo === "neutro" ? "bg-amber-500/15 text-amber-700 border-amber-500/40"
                  : "bg-red-500/15 text-red-700 border-red-500/40";
              return (
                <div key={r.id} className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`${cls} font-semibold`}>NPS {r.score}</Badge>
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

      <DrilldownDialog
        open={!!drilldown}
        onOpenChange={(o) => !o && setDrilldown(null)}
        data={drilldown}
        clientesById={clientesById}
      />
    </div>
  );
}


function FaixaPill({ color, label, active }: { color: string; label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-all ${
        active ? "border-2 font-semibold shadow-sm" : "border-border/60 opacity-70"
      }`}
      style={active ? { borderColor: color, background: `${color}15` } : {}}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span style={active ? { color } : {}}>{label}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  highlight,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: any;
  accent: "emerald" | "red" | "amber" | "blue" | "violet" | "indigo" | "pink";
  sub?: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const colors: Record<string, { icon: string; ring: string; text: string }> = {
    emerald: { icon: "text-white bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-600" },
    red: { icon: "text-white bg-red-500", ring: "ring-red-500/30", text: "text-red-600" },
    amber: { icon: "text-white bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-600" },
    blue: { icon: "text-white bg-blue-500", ring: "ring-blue-500/30", text: "text-blue-600" },
    violet: { icon: "text-white bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-600" },
    indigo: { icon: "text-white bg-indigo-500", ring: "ring-indigo-500/30", text: "text-indigo-600" },
    pink: { icon: "text-white bg-pink-500", ring: "ring-pink-500/30", text: "text-pink-600" },
  };
  const c = colors[accent];
  const clickable = !!onClick;
  return (
    <Card
      className={`${highlight ? `ring-2 ${c.ring}` : ""} ${
        clickable ? "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5" : ""
      }`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 shadow-sm ${c.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className={`text-2xl font-bold tabular-nums ${highlight ? c.text : ""}`}>{value}</div>
            {sub && <div className="text-[10px] font-medium text-muted-foreground">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DrilldownDialog({
  open,
  onOpenChange,
  data,
  clientesById,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: { title: string; description?: string; respostas: NpsResposta[] } | null;
  clientesById: Map<string, { id: string; nome: string; plano: string | null }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{data?.title ?? ""}</DialogTitle>
          {data?.description && <DialogDescription>{data.description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {!data || data.respostas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente nesta seleção.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Nota</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.respostas.map((r) => {
                  const c = clientesById.get(r.cliente_id);
                  const tipo = classifyNps(r.score);
                  const cls =
                    tipo === "promotor"
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40"
                      : tipo === "neutro"
                      ? "bg-amber-500/15 text-amber-700 border-amber-500/40"
                      : "bg-red-500/15 text-red-700 border-red-500/40";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className={`${cls} font-semibold`}>
                          {r.score}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to="/clientes/$clienteId"
                          params={{ clienteId: r.cliente_id }}
                          className="hover:underline"
                          onClick={() => onOpenChange(false)}
                        >
                          {c?.nome ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c?.plano ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {r.comentario ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {new Date(r.respondido_em).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

