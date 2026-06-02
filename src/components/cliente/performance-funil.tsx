import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Megaphone, Handshake, AlertTriangle, CheckCircle2 } from "lucide-react";

type Cenario = "pessimista" | "mediano" | "otimista";

type ParamsCenario = {
  cpl: number;
  qualificacao_pct: number; // % leads que viram qualificados
  cot_para_orc_pct: number; // % cotações que viram orçamento
  orc_para_venda_pct: number; // % orçamentos que viram venda
  ticket_medio: number;
};

type Metas = {
  semana: number;
  mes: number;
  longo: number;
};

type Realizado = {
  investimento: number;
  leads: number;
  qualificados: number;
  cotacoes: number;
  orcamentos: number;
  vendas: number;
  faturamento: number;
};

const DEFAULTS: Record<Cenario, ParamsCenario> = {
  pessimista: { cpl: 50, qualificacao_pct: 5, cot_para_orc_pct: 60, orc_para_venda_pct: 10, ticket_medio: 1500 },
  mediano:    { cpl: 35, qualificacao_pct: 15, cot_para_orc_pct: 70, orc_para_venda_pct: 25, ticket_medio: 2500 },
  otimista:   { cpl: 25, qualificacao_pct: 30, cot_para_orc_pct: 80, orc_para_venda_pct: 40, ticket_medio: 3500 },
};

function fmtMoney(v: number) {
  if (!isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtNum(v: number) {
  if (!isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function pct(realizado: number, meta: number) {
  if (!meta) return 0;
  return Math.max(0, Math.min(100, Math.round((realizado / meta) * 100)));
}

export function PerformanceFunil({ clienteId: _clienteId }: { clienteId: string }) {
  void _clienteId;
  const [periodo, setPeriodo] = useState<"15d" | "30d" | "mes">("30d");
  const [periodoLongoTipo, setPeriodoLongoTipo] = useState<"trimestre" | "semestre" | "ano">("trimestre");

  const [investimento, setInvestimento] = useState<number>(2000);
  const [params, setParams] = useState<Record<Cenario, ParamsCenario>>(DEFAULTS);

  const [realizado, setRealizado] = useState<Realizado>({
    investimento: 0, leads: 0, qualificados: 0, cotacoes: 0, orcamentos: 0, vendas: 0, faturamento: 0,
  });

  const [metas, setMetas] = useState<Record<keyof Realizado, Metas>>({
    investimento: { semana: 0, mes: 0, longo: 0 },
    leads:        { semana: 0, mes: 0, longo: 0 },
    qualificados: { semana: 0, mes: 0, longo: 0 },
    cotacoes:     { semana: 0, mes: 0, longo: 0 },
    orcamentos:   { semana: 0, mes: 0, longo: 0 },
    vendas:       { semana: 0, mes: 0, longo: 0 },
    faturamento:  { semana: 2500, mes: 10000, longo: 30000 },
  });

  // Calcular funil por cenário
  const funis = useMemo(() => {
    return (Object.keys(params) as Cenario[]).reduce((acc, k) => {
      const p = params[k];
      const leads = p.cpl > 0 ? investimento / p.cpl : 0;
      const qualificados = leads * (p.qualificacao_pct / 100);
      const cotacoes = qualificados; // cada qualificado vira uma cotação
      const orcamentos = cotacoes * (p.cot_para_orc_pct / 100);
      const vendas = orcamentos * (p.orc_para_venda_pct / 100);
      const faturamento = vendas * p.ticket_medio;
      const taxaConversao = leads > 0 ? (vendas / leads) * 100 : 0;
      acc[k] = { investimento, leads, qualificados, cotacoes, orcamentos, vendas, faturamento, taxaConversao, ticketMedio: p.ticket_medio };
      return acc;
    }, {} as Record<Cenario, Realizado & { taxaConversao: number; ticketMedio: number }>);
  }, [investimento, params]);

  const realizadoTaxaConversao = realizado.leads > 0 ? (realizado.vendas / realizado.leads) * 100 : 0;
  const realizadoTicket = realizado.vendas > 0 ? realizado.faturamento / realizado.vendas : 0;

  // Diagnóstico: comparar realizado com mediano para identificar onde está o gargalo
  const diagnostico = useMemo(() => {
    const med = funis.mediano;
    const etapas: { nome: string; real: number; esperado: number; tipo: "ok" | "alerta" }[] = [
      { nome: "Leads", real: realizado.leads, esperado: med.leads, tipo: "ok" },
      { nome: "Qualificados", real: realizado.qualificados, esperado: med.qualificados, tipo: "ok" },
      { nome: "Cotações", real: realizado.cotacoes, esperado: med.cotacoes, tipo: "ok" },
      { nome: "Orçamentos", real: realizado.orcamentos, esperado: med.orcamentos, tipo: "ok" },
      { nome: "Vendas", real: realizado.vendas, esperado: med.vendas, tipo: "ok" },
    ];
    return etapas.map((e) => ({ ...e, tipo: e.esperado > 0 && e.real < e.esperado * 0.8 ? "alerta" : "ok" as "ok" | "alerta" }));
  }, [funis, realizado]);

  const updateParam = (cen: Cenario, key: keyof ParamsCenario, value: number) => {
    setParams((prev) => ({ ...prev, [cen]: { ...prev[cen], [key]: value } }));
  };

  const updateMeta = (kpi: keyof Realizado, periodoMeta: keyof Metas, value: number) => {
    setMetas((prev) => ({ ...prev, [kpi]: { ...prev[kpi], [periodoMeta]: value } }));
  };

  const longoLabel = periodoLongoTipo === "trimestre" ? "Trimestre" : periodoLongoTipo === "semestre" ? "Semestre" : "Ano";

  return (
    <div className="space-y-6">
      {/* Filtros topo */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Período de análise</Label>
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
            <TabsList>
              <TabsTrigger value="15d">15 dias</TabsTrigger>
              <TabsTrigger value="30d">30 dias</TabsTrigger>
              <TabsTrigger value="mes">Mês atual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Meta de longo prazo</Label>
          <Select value={periodoLongoTipo} onValueChange={(v) => setPeriodoLongoTipo(v as typeof periodoLongoTipo)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trimestre">Trimestral</SelectItem>
              <SelectItem value="semestre">Semestral</SelectItem>
              <SelectItem value="ano">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Parâmetros da simulação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" /> Parâmetros da simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Investimento em ADS no período (R$)</Label>
            <Input
              type="number"
              className="max-w-[240px]"
              value={investimento}
              onChange={(e) => setInvestimento(Number(e.target.value) || 0)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">Parâmetro</th>
                  <th className="py-2 px-2 text-red-600">Pessimista</th>
                  <th className="py-2 px-2 text-amber-600">Mediano</th>
                  <th className="py-2 px-2 text-emerald-600">Otimista</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { key: "cpl", label: "CPL (R$ por lead)" },
                  { key: "qualificacao_pct", label: "% Qualificação dos leads" },
                  { key: "cot_para_orc_pct", label: "% Cotação → Orçamento" },
                  { key: "orc_para_venda_pct", label: "% Orçamento → Venda" },
                  { key: "ticket_medio", label: "Ticket médio (R$)" },
                ] as { key: keyof ParamsCenario; label: string }[]).map((row) => (
                  <tr key={row.key} className="border-b">
                    <td className="py-2 pr-2 text-muted-foreground">{row.label}</td>
                    {(["pessimista", "mediano", "otimista"] as Cenario[]).map((cen) => (
                      <td key={cen} className="py-1 px-2">
                        <Input
                          type="number"
                          className="h-8"
                          value={params[cen][row.key]}
                          onChange={(e) => updateParam(cen, row.key, Number(e.target.value) || 0)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Funil principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" /> Funil — Simulação vs Realizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Marketing */}
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Funil de Marketing</h3>
            </div>
            <FunilLinhas
              linhas={[
                { label: "Investimento ADS", isMoney: true,
                  vals: { pessimista: funis.pessimista.investimento, mediano: funis.mediano.investimento, otimista: funis.otimista.investimento, realizado: realizado.investimento },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, investimento: v }) },
                { label: "Leads gerados",
                  vals: { pessimista: funis.pessimista.leads, mediano: funis.mediano.leads, otimista: funis.otimista.leads, realizado: realizado.leads },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, leads: v }) },
                { label: "Leads qualificados",
                  vals: { pessimista: funis.pessimista.qualificados, mediano: funis.mediano.qualificados, otimista: funis.otimista.qualificados, realizado: realizado.qualificados },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, qualificados: v }) },
              ]}
            />
          </div>

          {/* Comercial */}
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
              <Handshake className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Funil Comercial</h3>
            </div>
            <FunilLinhas
              linhas={[
                { label: "Cotações enviadas",
                  vals: { pessimista: funis.pessimista.cotacoes, mediano: funis.mediano.cotacoes, otimista: funis.otimista.cotacoes, realizado: realizado.cotacoes },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, cotacoes: v }) },
                { label: "Orçamentos enviados",
                  vals: { pessimista: funis.pessimista.orcamentos, mediano: funis.mediano.orcamentos, otimista: funis.otimista.orcamentos, realizado: realizado.orcamentos },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, orcamentos: v }) },
                { label: "Vendas fechadas",
                  vals: { pessimista: funis.pessimista.vendas, mediano: funis.mediano.vendas, otimista: funis.otimista.vendas, realizado: realizado.vendas },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, vendas: v }) },
                { label: "Faturamento", isMoney: true,
                  vals: { pessimista: funis.pessimista.faturamento, mediano: funis.mediano.faturamento, otimista: funis.otimista.faturamento, realizado: realizado.faturamento },
                  onChangeRealizado: (v) => setRealizado({ ...realizado, faturamento: v }) },
              ]}
            />
            <div className="grid grid-cols-2 gap-3 border-t bg-muted/20 px-4 py-3 text-xs md:grid-cols-4">
              <Metric label="Conv. Pessimista" value={`${funis.pessimista.taxaConversao.toFixed(1)}%`} />
              <Metric label="Conv. Mediano" value={`${funis.mediano.taxaConversao.toFixed(1)}%`} />
              <Metric label="Conv. Otimista" value={`${funis.otimista.taxaConversao.toFixed(1)}%`} />
              <Metric label="Conv. Realizado" value={`${realizadoTaxaConversao.toFixed(1)}%`} highlight />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t bg-muted/20 px-4 py-3 text-xs md:grid-cols-4">
              <Metric label="Ticket Pessimista" value={fmtMoney(funis.pessimista.ticketMedio)} />
              <Metric label="Ticket Mediano" value={fmtMoney(funis.mediano.ticketMedio)} />
              <Metric label="Ticket Otimista" value={fmtMoney(funis.otimista.ticketMedio)} />
              <Metric label="Ticket Realizado" value={fmtMoney(realizadoTicket)} highlight />
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-2 text-sm font-medium">Diagnóstico do funil (vs cenário mediano)</p>
            <div className="flex flex-wrap gap-2">
              {diagnostico.map((d) => (
                <Badge
                  key={d.nome}
                  variant="secondary"
                  className={d.tipo === "alerta"
                    ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}
                >
                  {d.tipo === "alerta" ? <AlertTriangle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                  {d.nome}: {fmtNum(d.real)} / esperado {fmtNum(d.esperado)}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" /> Metas e progresso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: "faturamento" as const, label: "Faturamento", money: true },
            { key: "vendas" as const, label: "Vendas fechadas" },
            { key: "leads" as const, label: "Leads gerados" },
            { key: "qualificados" as const, label: "Leads qualificados" },
          ]).map((kpi) => {
            const m = metas[kpi.key];
            const r = realizado[kpi.key];
            const fmt = kpi.money ? fmtMoney : fmtNum;
            return (
              <div key={kpi.key} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{kpi.label}</h4>
                  <span className="text-xs text-muted-foreground">Realizado: <strong className="text-foreground">{fmt(r)}</strong></span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <MetaBarra
                    label="Semana"
                    realizado={r}
                    meta={m.semana}
                    onChangeMeta={(v) => updateMeta(kpi.key, "semana", v)}
                    fmt={fmt}
                  />
                  <MetaBarra
                    label="Mês"
                    realizado={r}
                    meta={m.mes}
                    onChangeMeta={(v) => updateMeta(kpi.key, "mes", v)}
                    fmt={fmt}
                  />
                  <MetaBarra
                    label={longoLabel}
                    realizado={r}
                    meta={m.longo}
                    onChangeMeta={(v) => updateMeta(kpi.key, "longo", v)}
                    fmt={fmt}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            * Layout em modo de visualização. Os valores ainda não são salvos — me confirme se o desenho está bom que eu já conecto ao banco.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "font-semibold text-primary" : "font-medium"}>{value}</p>
    </div>
  );
}

function FunilLinhas({
  linhas,
}: {
  linhas: {
    label: string;
    isMoney?: boolean;
    vals: { pessimista: number; mediano: number; otimista: number; realizado: number };
    onChangeRealizado: (v: number) => void;
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2">Etapa</th>
            <th className="px-2 py-2 text-red-600">Pessimista</th>
            <th className="px-2 py-2 text-amber-600">Mediano</th>
            <th className="px-2 py-2 text-emerald-600">Otimista</th>
            <th className="px-2 py-2">Realizado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const fmt = l.isMoney ? fmtMoney : fmtNum;
            return (
              <tr key={l.label} className="border-b">
                <td className="px-4 py-2 font-medium">{l.label}</td>
                <td className="px-2 py-2 text-muted-foreground">{fmt(l.vals.pessimista)}</td>
                <td className="px-2 py-2 text-muted-foreground">{fmt(l.vals.mediano)}</td>
                <td className="px-2 py-2 text-muted-foreground">{fmt(l.vals.otimista)}</td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    className="h-8 w-32"
                    value={l.vals.realizado}
                    onChange={(e) => l.onChangeRealizado(Number(e.target.value) || 0)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetaBarra({
  label,
  realizado,
  meta,
  onChangeMeta,
  fmt,
}: {
  label: string;
  realizado: number;
  meta: number;
  onChangeMeta: (v: number) => void;
  fmt: (v: number) => string;
}) {
  const p = pct(realizado, meta);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{p}%</span>
      </div>
      <Progress value={p} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{fmt(realizado)} /</span>
        <Input
          type="number"
          className="h-7 w-24"
          value={meta}
          onChange={(e) => onChangeMeta(Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}
