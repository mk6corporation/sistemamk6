import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotionSync } from "@/lib/sync.functions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  PauseCircle,
  Flag,
  UserPlus,
  ArrowRightLeft,
  Trash2,
  Sparkles,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Bar,
  ReferenceLine,
} from "recharts";


export const Route = createFileRoute("/")({
  component: Dashboard,
});

// ===== Types =====
type Cliente = {
  id: string;
  notion_page_id: string;
  nome: string;
  estagio: string | null;
  categoria: string | null;
  plano: string | null;
  operacional: Array<{ id: string; name: string; avatar_url: string | null }> | null;
  inicio_contrato: string | null;
  valor_mensal: number | null;
  removido_em: string | null;
  notion_last_edited_time: string | null;
};

type Mudanca = {
  id: string;
  cliente_id: string | null;
  notion_page_id: string;
  nome_cliente: string;
  estagio_anterior: string | null;
  estagio_novo: string | null;
  categoria_anterior: string | null;
  categoria_nova: string | null;
  tipo_mudanca: string;
  detectada_em: string;
  notion_edited_at: string | null;
};

// ===== UI helpers =====
const CATEGORIA_STYLE: Record<string, string> = {
  ATIVO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  PAUSADO: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  CHURN: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  FINALIZADO: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
  OUTRO: "bg-zinc-500/10 text-muted-foreground border-border",
};

const TIPO_LABEL: Record<string, { label: string; icon: any; className: string }> = {
  novo_cliente: { label: "Novo cliente", icon: UserPlus, className: "text-emerald-600" },
  churn: { label: "Churn", icon: TrendingDown, className: "text-red-600" },
  pausou: { label: "Pausou", icon: PauseCircle, className: "text-amber-600" },
  finalizou: { label: "Finalizou", icon: Flag, className: "text-zinc-600" },
  recuperou: { label: "Recuperou", icon: Sparkles, className: "text-emerald-600" },
  mudanca_estagio: { label: "Mudança de estágio", icon: ArrowRightLeft, className: "text-muted-foreground" },
  removido_do_notion: { label: "Removido do Notion", icon: Trash2, className: "text-red-600" },
  restaurado_no_notion: { label: "Restaurado no Notion", icon: Sparkles, className: "text-emerald-600" },
};

const TIPOS_RELEVANTES = new Set([
  "novo_cliente",
  "churn",
  "pausou",
  "finalizou",
  "recuperou",
  "removido_do_notion",
  "restaurado_no_notion",
]);

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatMes(d: Date) {
  return `${MESES_PT[d.getMonth()]} / ${d.getFullYear()}`;
}

function formatMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function estagioToCategoria(estagio: string | null): string {
  if (!estagio) return "OUTRO";
  if (estagio === "Pausado") return "PAUSADO";
  if (estagio === "Churn") return "CHURN";
  if (estagio === "Projeto Finalizado (Não Churn)") return "FINALIZADO";
  if (
    estagio === "Cliente" ||
    estagio === "Financeiro" ||
    estagio === "Contrato Assinado" ||
    estagio === "Aviso de Churn" ||
    estagio === "Formulário de Cliente"
  ) {
    return "ATIVO";
  }
  return "OUTRO";
}

// Tipos de mudança que efetivamente alteram o estágio (para reconstrução histórica)
const TIPOS_QUE_MUDAM_ESTAGIO = new Set([
  "mudanca_estagio",
  "pausou",
  "churn",
  "finalizou",
  "recuperou",
]);

// ===== Page =====
function Dashboard() {
  const qc = useQueryClient();
  const syncFn = useServerFn(triggerNotionSync);
  const [lastResult, setLastResult] = useState<any>(null);
  const [filtroOperacional, setFiltroOperacional] = useState<string>("todos");
  const hojeRef = new Date();
  const [mesSelecionado, setMesSelecionado] = useState<string>(
    `${hojeRef.getFullYear()}-${String(hojeRef.getMonth()).padStart(2, "0")}`,
  );


  const mutation = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries();
    },
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const mudancasQuery = useQuery({
    queryKey: ["mudancas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mudancas_estagio")
        .select("*")
        .order("detectada_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Mudanca[];
    },
  });

  const runsQuery = useQuery({
    queryKey: ["sync_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_runs")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientes = clientesQuery.data ?? [];
  const ativos = clientes.filter((c) => !c.removido_em);

  // Filter options
  const operacionais = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of ativos) {
      for (const op of c.operacional ?? []) {
        if (op?.id && op?.name) map.set(op.id, op.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [ativos]);

  // Filtered clients
  const clientesFiltrados = useMemo(() => {
    return ativos.filter((c) => {
      if (filtroOperacional !== "todos") {
        const has = (c.operacional ?? []).some((op) => op.id === filtroOperacional);
        if (!has) return false;
      }
      return true;
    });
  }, [ativos, filtroOperacional]);

  // KPIs
  const kpis = useMemo(() => {
    const counts: Record<string, number> = {
      ATIVO: 0, PAUSADO: 0, CHURN: 0, FINALIZADO: 0, OUTRO: 0,
    };
    let mrr = 0;
    let avisoChurn = 0;
    let aceleracaoPro = 0;
    for (const c of clientesFiltrados) {
      const key = c.categoria ?? "OUTRO";
      counts[key] = (counts[key] ?? 0) + 1;
      if (key === "ATIVO" && c.valor_mensal) mrr += Number(c.valor_mensal);
      if (c.estagio === "Aviso de Churn") avisoChurn += 1;
      if (key === "ATIVO" && c.plano === "Aceleração Turismo PRO") aceleracaoPro += 1;
    }
    const outrosAtivos = counts.ATIVO - aceleracaoPro;
    return { counts, mrr, avisoChurn, aceleracaoPro, outrosAtivos, total: clientesFiltrados.length };
  }, [clientesFiltrados]);

  // Feed by month
  const idsClientesFiltrados = useMemo(
    () => new Set(clientesFiltrados.map((c) => c.notion_page_id)),
    [clientesFiltrados],
  );

  const mudancasRelevantes = useMemo(() => {
    const list = (mudancasQuery.data ?? []).filter(
      (m) =>
        TIPOS_RELEVANTES.has(m.tipo_mudanca) &&
        (filtroOperacional === "todos"
          ? true
          : idsClientesFiltrados.has(m.notion_page_id)),
    );
    return list;
  }, [mudancasQuery.data, idsClientesFiltrados, filtroOperacional]);

  const feedPorMes = useMemo(() => {
    const buckets = new Map<string, Mudanca[]>();
    for (const m of mudancasRelevantes) {
      const d = new Date(m.detectada_em);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const arr = buckets.get(key) ?? [];
      arr.push(m);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => {
        const [y, mo] = key.split("-").map(Number);
        const stats: Record<string, number> = {};
        for (const it of items) {
          stats[it.tipo_mudanca] = (stats[it.tipo_mudanca] ?? 0) + 1;
        }
        return { key, label: formatMes(new Date(y, mo, 1)), items, stats };
      });
  }, [mudancasRelevantes]);

  // ===== Snapshot helper =====
  const snapshotAt = useMemo(() => {
    const todasMudancas = mudancasQuery.data ?? [];
    const mudancasEstagio = todasMudancas
      .filter((m) => TIPOS_QUE_MUDAM_ESTAGIO.has(m.tipo_mudanca))
      .sort((a, b) =>
        new Date(b.detectada_em).getTime() - new Date(a.detectada_em).getTime(),
      );

    return (date: Date) => {
      const T = date.getTime();
      const estagioPor: Record<string, string | null> = {};
      for (const c of clientesFiltrados) {
        estagioPor[c.notion_page_id] = c.estagio;
      }
      for (const m of mudancasEstagio) {
        if (new Date(m.detectada_em).getTime() > T) {
          if (m.notion_page_id in estagioPor) {
            estagioPor[m.notion_page_id] = m.estagio_anterior;
          }
        }
      }
      let ativos = 0;
      let acelPro = 0;
      for (const c of clientesFiltrados) {
        if (c.inicio_contrato && new Date(c.inicio_contrato).getTime() > T) continue;
        if (c.removido_em && new Date(c.removido_em).getTime() <= T) continue;
        const cat = estagioToCategoria(estagioPor[c.notion_page_id] ?? null);
        if (cat !== "ATIVO") continue;
        ativos += 1;
        if (c.plano === "Aceleração Turismo PRO") acelPro += 1;
      }
      return { ativos, acelPro, outros: ativos - acelPro };
    };
  }, [clientesFiltrados, mudancasQuery.data]);

  // ===== Evolução mensal (últimos 12 meses, dia 01) =====
  const mesesUltimos12 = useMemo(() => {
    const hoje = new Date();
    const arr: { key: string; label: string; labelCurto: string; date: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      arr.push({
        key: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`,
        label: formatMes(d),
        labelCurto: `${MESES_PT[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`,
        date: d,
      });
    }
    return arr;
  }, []);

  const evolucaoMensal = useMemo(() => {
    return mesesUltimos12.map(({ key, labelCurto, date }) => {
      const snap = snapshotAt(date);
      return { key, label: labelCurto, ...snap };
    });
  }, [mesesUltimos12, snapshotAt]);

  // ===== Comparação do mês selecionado =====
  const comparacaoMes = useMemo(() => {
    const mes = mesesUltimos12.find((m) => m.key === mesSelecionado) ?? mesesUltimos12[mesesUltimos12.length - 1];
    const inicio = snapshotAt(mes.date);
    const proximoMes = new Date(mes.date.getFullYear(), mes.date.getMonth() + 1, 1);
    const agora = new Date();
    const ehMesAtual = proximoMes.getTime() > agora.getTime();
    const fimDate = ehMesAtual ? agora : proximoMes;
    const fim = snapshotAt(fimDate);
    return { mes, inicio, fim, ehMesAtual };
  }, [mesSelecionado, mesesUltimos12, snapshotAt]);


  const ultimaSync = runsQuery.data?.[0] as any;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              MK6 — Painel de Clientes
            </h1>
            <p className="text-sm text-muted-foreground">
              Sincronizado com o Notion · {ultimaSync ? `Última sync ${formatData(ultimaSync.iniciado_em)}` : "Nunca sincronizado"}
            </p>
          </div>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            size="lg"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar agora
              </>
            )}
          </Button>
        </header>

        {lastResult && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            {lastResult.status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="font-medium">Última execução:</span>
            <span>{lastResult.clientes_processados} processados</span>
            <span>· +{lastResult.clientes_novos} novos</span>
            <span>· −{lastResult.clientes_removidos ?? 0} removidos</span>
            <span>· {lastResult.mudancas_detectadas} mudanças</span>
            {lastResult.erro && (
              <span className="text-red-600">· {lastResult.erro}</span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
          <Select value={filtroOperacional} onValueChange={setFiltroOperacional}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Operacional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os operacionais</SelectItem>
              {operacionais.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtroOperacional !== "todos" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiltroOperacional("todos")}
            >
              Limpar
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Mês de análise:</span>
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...mesesUltimos12].reverse().map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <KpiCard
            label="Ativos"
            value={kpis.counts.ATIVO}
            accent="emerald"
            icon={TrendingUp}
            comparacao={{ inicio: comparacaoMes.inicio.ativos, fim: comparacaoMes.fim.ativos, ehMesAtual: comparacaoMes.ehMesAtual }}
          />
          <KpiCard
            label="Jorney + Outros"
            value={kpis.outrosAtivos}
            accent="emerald"
            icon={TrendingUp}
            comparacao={{ inicio: comparacaoMes.inicio.outros, fim: comparacaoMes.fim.outros, ehMesAtual: comparacaoMes.ehMesAtual }}
          />
          <KpiCard
            label="Aceleração Turismo Pro"
            value={kpis.aceleracaoPro}
            accent="emerald"
            icon={Sparkles}
            comparacao={{ inicio: comparacaoMes.inicio.acelPro, fim: comparacaoMes.fim.acelPro, ehMesAtual: comparacaoMes.ehMesAtual }}
          />
          <KpiCard label="Pausados" value={kpis.counts.PAUSADO} accent="amber" icon={PauseCircle} />
          <KpiCard label="Churn" value={kpis.counts.CHURN} accent="red" icon={TrendingDown} />
          <KpiCard label="Finalizados" value={kpis.counts.FINALIZADO} accent="zinc" icon={Flag} />
          <KpiCard label="Aviso de Churn" value={kpis.avisoChurn} accent="amber" icon={AlertCircle} />
          <KpiCard label="MRR (ativos)" value={formatMoney(kpis.mrr)} accent="emerald" icon={Sparkles} />
        </div>

        <Tabs defaultValue="evolucao" className="w-full">
          <TabsList>
            <TabsTrigger value="evolucao">Evolução mensal</TabsTrigger>
            <TabsTrigger value="feed">Feed de mudanças</TabsTrigger>
            <TabsTrigger value="clientes">Clientes ({clientesFiltrados.length})</TabsTrigger>
          </TabsList>

          {/* Evolução mensal */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Ativos no dia 01 — últimos 12 meses</CardTitle>
                </div>
                <CardDescription>
                  Snapshot reconstruído a partir do histórico de mudanças. Meses anteriores ao
                  início do sync ({ultimaSync ? formatData(ultimaSync.iniciado_em) : "—"}) refletem
                  o estado atual filtrado por <code>início de contrato</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucaoMensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="ativos"
                        name="Ativos (total)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="outros"
                        name="Jorney + Outros"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="acelPro"
                        name="Aceleração Turismo Pro"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento mês a mês</CardTitle>
                <CardDescription>
                  Variação em relação ao mês anterior entre parênteses.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Ativos (total)</TableHead>
                      <TableHead className="text-right">Jorney + Outros</TableHead>
                      <TableHead className="text-right">Aceleração Turismo Pro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evolucaoMensal.map((m, i) => {
                      const prev = i > 0 ? evolucaoMensal[i - 1] : null;
                      const renderDelta = (cur: number, p: number | undefined) => {
                        if (p == null) return null;
                        const d = cur - p;
                        if (d === 0) return <span className="ml-2 text-xs text-muted-foreground">(0)</span>;
                        const cls = d > 0 ? "text-emerald-600" : "text-red-600";
                        return <span className={`ml-2 text-xs ${cls}`}>({d > 0 ? "+" : ""}{d})</span>;
                      };
                      return (
                        <TableRow key={m.key}>
                          <TableCell className="font-medium">{m.label}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.ativos}{renderDelta(m.ativos, prev?.ativos)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.outros}{renderDelta(m.outros, prev?.outros)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.acelPro}{renderDelta(m.acelPro, prev?.acelPro)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Feed */}
          <TabsContent value="feed" className="space-y-6">
            {mudancasQuery.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : feedPorMes.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma mudança relevante ainda. Rode uma sincronização.
                </CardContent>
              </Card>
            ) : (
              feedPorMes.map((mes) => (
                <Card key={mes.key}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="capitalize">{mes.label}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(mes.stats).map(([tipo, qtd]) => {
                          const meta = TIPO_LABEL[tipo];
                          if (!meta) return null;
                          return (
                            <Badge key={tipo} variant="outline" className="gap-1">
                              <meta.icon className={`h-3 w-3 ${meta.className}`} />
                              {meta.label}: {qtd}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <CardDescription>{mes.items.length} eventos no mês</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mes.items.map((it) => {
                      const meta = TIPO_LABEL[it.tipo_mudanca] ?? TIPO_LABEL.mudanca_estagio;
                      const Icon = meta.icon;
                      return (
                        <div
                          key={it.id}
                          className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/20 p-3 text-sm"
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} />
                          <span className="font-medium">{it.nome_cliente}</span>
                          <Badge variant="outline" className={meta.className}>
                            {meta.label}
                          </Badge>
                          {it.estagio_anterior && it.estagio_novo && (
                            <span className="text-xs text-muted-foreground">
                              {it.estagio_anterior} → {it.estagio_novo}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {formatData(it.detectada_em)}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="clientes">
            <Card>
              <CardContent className="p-0">
                {clientesQuery.isLoading ? (
                  <div className="p-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Estágio</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Operacional</TableHead>
                        <TableHead className="text-right">MRR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={CATEGORIA_STYLE[c.categoria ?? "OUTRO"]}
                            >
                              {c.categoria ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.estagio ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{c.plano ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            {(c.operacional ?? []).map((o) => o.name).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatMoney(c.valor_mensal)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                            Nenhum cliente com esses filtros.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  icon: Icon,
  comparacao,
}: {
  label: string;
  value: string | number;
  accent: "emerald" | "amber" | "red" | "zinc";
  icon: any;
  comparacao?: { inicio: number; fim: number; ehMesAtual: boolean };
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    red: "text-red-600 bg-red-500/10",
    zinc: "text-zinc-600 bg-zinc-500/10",
  };
  const delta = comparacao ? comparacao.fim - comparacao.inicio : 0;
  const deltaColor =
    delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";
  const deltaSign = delta > 0 ? "+" : "";
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
          </div>
        </div>
        {comparacao && (
          <div className="flex items-center justify-between border-t pt-2 text-xs tabular-nums">
            <span className="text-muted-foreground">
              Início: <span className="font-medium text-foreground">{comparacao.inicio}</span>
            </span>
            <span className="text-muted-foreground">
              {comparacao.ehMesAtual ? "Hoje" : "Fim"}:{" "}
              <span className="font-medium text-foreground">{comparacao.fim}</span>
            </span>
            <span className={`font-semibold ${deltaColor}`}>
              {deltaSign}{delta}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

