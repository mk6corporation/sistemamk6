import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Smile, Meh, Frown, TrendingUp, Users, LineChart as LineChartIcon } from "lucide-react";
import { toast } from "sonner";
import { PerformanceFunil } from "./performance-funil";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { RespostasCompletasDialog } from "@/components/nps/respostas-completas-dialog";

type NPS = {
  id: string;
  score: number;
  comentario: string | null;
  respondido_em: string;
  source: string | null;
  responsavel?: string | null;
  respostas?: Record<string, unknown> | null;
};

type Perf = {
  id?: string;
  cliente_id: string;
  leads_inicial: number | null;
  leads_atual: number | null;
  faturamento_inicial: number | null;
  faturamento_atual: number | null;
  faturamento_meta: number | null;
  observacoes: string | null;
};

function classifyNPS(score: number) {
  if (score >= 9) return { label: "Promotor", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", Icon: Smile };
  if (score >= 7) return { label: "Neutro", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", Icon: Meh };
  return { label: "Detrator", color: "bg-red-500/15 text-red-700 dark:text-red-400", Icon: Frown };
}

function formatMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function growthPct(inicial: number | null, atual: number | null, meta: number | null) {
  if (inicial == null || atual == null || meta == null) return null;
  if (meta <= inicial) return atual >= meta ? 100 : 0;
  const pct = ((atual - inicial) / (meta - inicial)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function SatisfacaoTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const npsQuery = useQuery({
    queryKey: ["nps", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_nps")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("respondido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NPS[];
    },
  });

  const perfQuery = useQuery({
    queryKey: ["perf", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_performance")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as Perf | null;
    },
  });

  const npsRows = npsQuery.data ?? [];

  // Month filter: "all" or "YYYY-MM"
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const n of npsRows) {
      const d = new Date(n.respondido_em);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      set.add(ym);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [npsRows]);

  const filteredRows = useMemo(() => {
    if (monthFilter === "all") return npsRows;
    return npsRows.filter((n) => {
      const d = new Date(n.respondido_em);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return ym === monthFilter;
    });
  }, [npsRows, monthFilter]);

  // Cards: when "all", usa últimos 90 dias; senão usa o mês filtrado
  const baseRows = monthFilter === "all"
    ? npsRows.filter((n) => Date.now() - new Date(n.respondido_em).getTime() <= 90 * 24 * 60 * 60 * 1000)
    : filteredRows;

  const avgBase = baseRows.length ? baseRows.reduce((s, n) => s + n.score, 0) / baseRows.length : null;
  const promoters = baseRows.filter((n) => n.score >= 9).length;
  const detractors = baseRows.filter((n) => n.score <= 6).length;
  const npsScore = baseRows.length
    ? Math.round(((promoters - detractors) / baseRows.length) * 100)
    : null;

  // Evolução mensal (média e NPS por mês), ordem crescente
  const monthlyEvolution = useMemo(() => {
    const map = new Map<string, { scores: number[] }>();
    for (const n of npsRows) {
      const d = new Date(n.respondido_em);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(ym)) map.set(ym, { scores: [] });
      map.get(ym)!.scores.push(n.score);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([ym, v]) => {
        const total = v.scores.length;
        const media = v.scores.reduce((s, x) => s + x, 0) / total;
        const p = v.scores.filter((s) => s >= 9).length;
        const d = v.scores.filter((s) => s <= 6).length;
        const nps = Math.round(((p - d) / total) * 100);
        const [y, m] = ym.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        return { ym, label, media: Number(media.toFixed(2)), nps, respostas: total };
      });
  }, [npsRows]);

  const [perf, setPerf] = useState<Perf>({
    cliente_id: clienteId,
    leads_inicial: null,
    leads_atual: null,
    faturamento_inicial: null,
    faturamento_atual: null,
    faturamento_meta: null,
    observacoes: null,
  });

  useEffect(() => {
    if (perfQuery.data) setPerf(perfQuery.data);
  }, [perfQuery.data]);

  const savePerf = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente_id: clienteId,
        leads_inicial: perf.leads_inicial,
        leads_atual: perf.leads_atual,
        faturamento_inicial: perf.faturamento_inicial,
        faturamento_atual: perf.faturamento_atual,
        faturamento_meta: perf.faturamento_meta,
        observacoes: perf.observacoes,
      };
      if (perf.id) {
        const { error } = await supabase
          .from("cliente_performance")
          .update(payload)
          .eq("id", perf.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cliente_performance")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Performance salva");
      qc.invalidateQueries({ queryKey: ["perf", clienteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fatPct = growthPct(perf.faturamento_inicial, perf.faturamento_atual, perf.faturamento_meta);

  return (
    <div className="space-y-6">
      {/* NPS */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5" /> Satisfação (NPS)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Filtrar por mês</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Selecionar mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Últimos 90 dias</SelectItem>
                  {monthOptions.map((ym) => {
                    const [y, m] = ym.split("-");
                    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                    return (
                      <SelectItem key={ym} value={ym}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {npsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      {monthFilter === "all" ? "Média (90 dias)" : "Média do mês"}
                    </p>
                    <p className="text-3xl font-bold">{avgBase != null ? avgBase.toFixed(1) : "—"}</p>
                    <p className="text-xs text-muted-foreground">{baseRows.length} resposta(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">NPS</p>
                    <p className="text-3xl font-bold">{npsScore ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {promoters} promotor(es) · {detractors} detrator(es)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      {monthFilter === "all" ? "Última resposta" : "Resposta mais recente do mês"}
                    </p>
                    <p className="text-lg font-medium">
                      {baseRows[0]
                        ? new Date(baseRows[0].respondido_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </p>
                    {baseRows[0] && (
                      <Badge className={classifyNPS(baseRows[0].score).color} variant="secondary">
                        Nota {baseRows[0].score} · {classifyNPS(baseRows[0].score).label}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Evolução mensal */}
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Evolução do NPS ao longo dos meses</p>
                </div>
                {monthlyEvolution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar o gráfico.</p>
                ) : (
                  <div className="h-[260px] w-full">
                    {mounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyEvolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 12 }} />
                          <YAxis yAxisId="right" orientation="right" domain={[-100, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                            formatter={(value: number, name: string) => {
                              if (name === "Média (0-10)") return [Number(value).toFixed(1), name];
                              return [value, name];
                            }}
                          />
                          <ReferenceLine yAxisId="right" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Line yAxisId="left" type="monotone" dataKey="media" name="Média (0-10)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line yAxisId="right" type="monotone" dataKey="nps" name="NPS" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Histórico {monthFilter !== "all" && <span className="text-xs text-muted-foreground">· filtrado</span>}
                </p>
                {filteredRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {npsRows.length === 0
                      ? "Nenhuma resposta de NPS ainda. As respostas enviadas pelo sistema externo aparecem aqui automaticamente."
                      : "Nenhuma resposta neste mês."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredRows.map((n) => {
                      const c = classifyNPS(n.score);
                      const Icon = c.Icon;
                      return (
                        <div key={n.id} className="flex items-start gap-3 rounded-md border p-3">
                          <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={c.color} variant="secondary">
                                {n.score} · {c.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(n.respondido_em).toLocaleString("pt-BR")}
                              </span>
                              {n.source && (
                                <span className="text-xs text-muted-foreground">via {n.source}</span>
                              )}
                              {n.responsavel && (
                                <span className="text-xs text-muted-foreground">· {n.responsavel}</span>
                              )}
                              <div className="ml-auto">
                                <RespostasCompletasDialog resposta={n} />
                              </div>
                            </div>
                            {n.comentario && (
                              <p className="mt-1 text-sm">{n.comentario}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Performance / Funil */}
      <PerformanceFunil clienteId={clienteId} />
    </div>
  );
}
