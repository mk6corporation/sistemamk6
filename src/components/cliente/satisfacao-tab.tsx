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

type NPS = {
  id: string;
  score: number;
  comentario: string | null;
  respondido_em: string;
  source: string | null;
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
  const recent = npsRows.filter((n) => {
    const d = new Date(n.respondido_em).getTime();
    return Date.now() - d <= 90 * 24 * 60 * 60 * 1000;
  });
  const avg90 = recent.length
    ? recent.reduce((s, n) => s + n.score, 0) / recent.length
    : null;
  const promoters = recent.filter((n) => n.score >= 9).length;
  const detractors = recent.filter((n) => n.score <= 6).length;
  const npsScore = recent.length
    ? Math.round(((promoters - detractors) / recent.length) * 100)
    : null;

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
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" /> Satisfação (NPS)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {npsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Média (90 dias)</p>
                    <p className="text-3xl font-bold">{avg90 != null ? avg90.toFixed(1) : "—"}</p>
                    <p className="text-xs text-muted-foreground">{recent.length} resposta(s)</p>
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
                    <p className="text-xs text-muted-foreground">Última resposta</p>
                    <p className="text-lg font-medium">
                      {npsRows[0]
                        ? new Date(npsRows[0].respondido_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </p>
                    {npsRows[0] && (
                      <Badge className={classifyNPS(npsRows[0].score).color} variant="secondary">
                        Nota {npsRows[0].score} · {classifyNPS(npsRows[0].score).label}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Histórico</p>
                {npsRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma resposta de NPS ainda. As respostas enviadas pelo sistema externo aparecem aqui automaticamente.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {npsRows.map((n) => {
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Performance do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {perfQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Faturamento */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Faturamento</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Inicial</p>
                      <p className="text-sm font-medium">{formatMoney(perf.faturamento_inicial)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Atual</p>
                      <p className="text-sm font-medium text-primary">{formatMoney(perf.faturamento_atual)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Meta</p>
                      <p className="text-sm font-medium">{formatMoney(perf.faturamento_meta)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Progresso até a meta</span>
                      <span>{fatPct != null ? `${fatPct}%` : "—"}</span>
                    </div>
                    <Progress value={fatPct ?? 0} />
                  </div>
                </div>

                {/* Leads */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Leads</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Inicial</p>
                      <p className="text-lg font-semibold">{perf.leads_inicial ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Atual</p>
                      <p className="text-lg font-semibold text-primary">{perf.leads_atual ?? "—"}</p>
                    </div>
                  </div>
                  {perf.leads_inicial != null && perf.leads_atual != null && (
                    <p className="text-xs text-muted-foreground">
                      {perf.leads_atual >= perf.leads_inicial ? "▲" : "▼"}{" "}
                      {perf.leads_inicial === 0
                        ? "—"
                        : `${Math.round(((perf.leads_atual - perf.leads_inicial) / perf.leads_inicial) * 100)}%`}{" "}
                      vs início
                    </p>
                  )}
                </div>
              </div>

              {/* Edição manual */}
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">Editar dados (preenchimento manual)</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label>Faturamento inicial (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={perf.faturamento_inicial ?? ""}
                      onChange={(e) =>
                        setPerf({ ...perf, faturamento_inicial: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Faturamento atual (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={perf.faturamento_atual ?? ""}
                      onChange={(e) =>
                        setPerf({ ...perf, faturamento_atual: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Faturamento esperado / meta (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={perf.faturamento_meta ?? ""}
                      onChange={(e) =>
                        setPerf({ ...perf, faturamento_meta: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Leads inicial</Label>
                    <Input
                      type="number"
                      value={perf.leads_inicial ?? ""}
                      onChange={(e) =>
                        setPerf({ ...perf, leads_inicial: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Leads atual</Label>
                    <Input
                      type="number"
                      value={perf.leads_atual ?? ""}
                      onChange={(e) =>
                        setPerf({ ...perf, leads_atual: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={perf.observacoes ?? ""}
                    onChange={(e) => setPerf({ ...perf, observacoes: e.target.value })}
                  />
                </div>
                <Button onClick={() => savePerf.mutate()} disabled={savePerf.isPending}>
                  {savePerf.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
