import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Megaphone,
  Handshake,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  TrendingUp,
} from "lucide-react";

type Cenario = "pessimista" | "mediano" | "otimista";

type ParamsCenario = {
  cpl: number;
  qualificacao_pct: number; // % leads → qualificados
  cot_para_venda_pct: number; // % cotações → vendas
  ticket_medio: number;
  margem_liquida_pct: number; // % faturamento bruto que vira líquido
};

type Realizado = {
  investimento: number;
  leads: number;
  cpl: number;
  qualificados: number;
  cotacoes: number;
  vendas: number;
  faturamentoBruto: number;
  faturamentoLiquido: number;
};

const DEFAULTS: Record<Cenario, ParamsCenario> = {
  pessimista: { cpl: 50, qualificacao_pct: 20, cot_para_venda_pct: 8, ticket_medio: 1500, margem_liquida_pct: 60 },
  mediano: { cpl: 35, qualificacao_pct: 35, cot_para_venda_pct: 18, ticket_medio: 2500, margem_liquida_pct: 70 },
  otimista: { cpl: 25, qualificacao_pct: 50, cot_para_venda_pct: 30, ticket_medio: 3500, margem_liquida_pct: 80 },
};

const MK_COLOR = "#f59e0b"; // amber - marketing
const CO_COLOR = "#3b82f6"; // blue - commercial

import { fmtBRL, fmtInt, fmtPct as fmtPctShared } from "@/lib/format";

function fmtMoney(v: number) {
  return fmtBRL(v);
}
function fmtNum(v: number) {
  return fmtInt(v);
}
function fmtPct(v: number) {
  return fmtPctShared(v, 1);
}
function pct(realizado: number, meta: number) {
  if (!meta) return 0;
  return Math.max(0, Math.min(100, Math.round((realizado / meta) * 100)));
}

function calcCenario(investimento: number, p: ParamsCenario) {
  const leads = p.cpl > 0 ? investimento / p.cpl : 0;
  const qualificados = leads * (p.qualificacao_pct / 100);
  const cotacoes = qualificados;
  const vendas = cotacoes * (p.cot_para_venda_pct / 100);
  const faturamentoBruto = vendas * p.ticket_medio;
  const faturamentoLiquido = faturamentoBruto * (p.margem_liquida_pct / 100);
  const cplq = qualificados > 0 ? investimento / qualificados : 0;
  const taxaConv = cotacoes > 0 ? (vendas / cotacoes) * 100 : 0;
  const ticket = vendas > 0 ? faturamentoLiquido / vendas : 0;
  return {
    leads,
    cpl: p.cpl,
    qualificados,
    cplq,
    taxaQualificacao: p.qualificacao_pct,
    cotacoes,
    vendas,
    taxaConv,
    faturamentoBruto,
    faturamentoLiquido,
    ticket,
  };
}

export function PerformanceFunil({ clienteId: _clienteId }: { clienteId: string }) {
  void _clienteId;

  const [investimento, setInvestimento] = useState<number>(2000);
  const [params, setParams] = useState<Record<Cenario, ParamsCenario>>(DEFAULTS);

  const [realizadoFiltro, setRealizadoFiltro] = useState<"15d" | "30d" | "mes" | "trimestre">("30d");

  const [realizado, setRealizado] = useState<Realizado>({
    investimento: 0,
    leads: 0,
    cpl: 0,
    qualificados: 0,
    cotacoes: 0,
    vendas: 0,
    faturamentoBruto: 0,
    faturamentoLiquido: 0,
  });

  const [metaPeriodo, setMetaPeriodo] = useState<"mes" | "trimestre">("mes");
  const [metas, setMetas] = useState<Record<"faturamento" | "leads" | "qualificados", { mes: number; trimestre: number }>>({
    faturamento: { mes: 30000, trimestre: 90000 },
    leads: { mes: 200, trimestre: 600 },
    qualificados: { mes: 60, trimestre: 180 },
  });

  const cenarios = useMemo(() => ({
    pessimista: calcCenario(investimento, params.pessimista),
    mediano: calcCenario(investimento, params.mediano),
    otimista: calcCenario(investimento, params.otimista),
  }), [investimento, params]);

  // Realizado calculados
  const realCPL = realizado.leads > 0 ? realizado.investimento / realizado.leads : 0;
  const realCPLQ = realizado.qualificados > 0 ? realizado.investimento / realizado.qualificados : 0;
  const realTaxaQual = realizado.leads > 0 ? (realizado.qualificados / realizado.leads) * 100 : 0;
  const realTaxaConv = realizado.cotacoes > 0 ? (realizado.vendas / realizado.cotacoes) * 100 : 0;
  const realTicket = realizado.vendas > 0 ? realizado.faturamentoLiquido / realizado.vendas : 0;

  const diagnostico = useMemo(() => {
    const med = cenarios.mediano;
    const etapas = [
      { nome: "Leads", real: realizado.leads, esperado: med.leads, area: "mk" as const },
      { nome: "Qualificados", real: realizado.qualificados, esperado: med.qualificados, area: "mk" as const },
      { nome: "Cotações", real: realizado.cotacoes, esperado: med.cotacoes, area: "co" as const },
      { nome: "Vendas", real: realizado.vendas, esperado: med.vendas, area: "co" as const },
      { nome: "Faturamento líquido", real: realizado.faturamentoLiquido, esperado: med.faturamentoLiquido, area: "co" as const },
    ];
    return etapas.map((e) => ({
      ...e,
      tipo: e.esperado > 0 && e.real < e.esperado * 0.8 ? ("alerta" as const) : ("ok" as const),
    }));
  }, [cenarios, realizado]);

  const updateParam = (cen: Cenario, key: keyof ParamsCenario, value: number) => {
    setParams((prev) => ({ ...prev, [cen]: { ...prev[cen], [key]: value } }));
  };

  return (
    <div className="space-y-6">
      {/* ============ CALCULADORA ============ */}
      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5" /> Calculadora de Cenários
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Informe o investimento em marketing e os parâmetros de cada cenário para calcular o possível retorno.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Investimento */}
          <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
            <Label className="text-xs font-semibold uppercase tracking-wide text-primary">
              Investimento em ADS (R$)
            </Label>
            <Input
              type="number"
              className="mt-1 max-w-[280px] text-lg font-semibold"
              value={investimento}
              onChange={(e) => setInvestimento(Number(e.target.value) || 0)}
            />
          </div>

          {/* Parâmetros: Marketing (amber) + Comercial (blue) */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* MARKETING */}
            <div className="rounded-lg border-2 p-3" style={{ borderColor: `${MK_COLOR}50`, background: `${MK_COLOR}08` }}>
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-md p-1.5" style={{ background: `${MK_COLOR}20` }}>
                  <Megaphone className="h-4 w-4" style={{ color: MK_COLOR }} />
                </div>
                <h4 className="text-sm font-bold" style={{ color: MK_COLOR }}>Marketing</h4>
              </div>
              <ParamRow label="CPL (R$ por lead)" k="cpl" params={params} onChange={updateParam} />
              <ParamRow label="% Qualificação dos leads" k="qualificacao_pct" params={params} onChange={updateParam} suffix="%" />
            </div>

            {/* COMERCIAL */}
            <div className="rounded-lg border-2 p-3" style={{ borderColor: `${CO_COLOR}50`, background: `${CO_COLOR}08` }}>
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-md p-1.5" style={{ background: `${CO_COLOR}20` }}>
                  <Handshake className="h-4 w-4" style={{ color: CO_COLOR }} />
                </div>
                <h4 className="text-sm font-bold" style={{ color: CO_COLOR }}>Comercial</h4>
              </div>
              <ParamRow label="% Cotação → Venda" k="cot_para_venda_pct" params={params} onChange={updateParam} suffix="%" />
              <ParamRow label="Ticket médio (R$)" k="ticket_medio" params={params} onChange={updateParam} />
              <ParamRow label="% Margem líquida" k="margem_liquida_pct" params={params} onChange={updateParam} suffix="%" />
            </div>
          </div>

          {/* Resultado: 3 cards de cenário com faturamento previsto */}
          <div className="grid gap-3 md:grid-cols-3">
            <CenarioCard nome="Pessimista" cor="rgb(239 68 68)" data={cenarios.pessimista} />
            <CenarioCard nome="Mediano" cor="rgb(245 158 11)" data={cenarios.mediano} destaque />
            <CenarioCard nome="Otimista" cor="rgb(16 185 129)" data={cenarios.otimista} />
          </div>
        </CardContent>
      </Card>

      {/* ============ FUNIS VISUAIS (CENÁRIOS) ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5" /> Funis projetados — Cenário Mediano
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Visualização do funil baseado nos parâmetros do cenário mediano.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <FunilVisual
              titulo="Funil de Marketing"
              icon={<Megaphone className="h-4 w-4" />}
              cor={MK_COLOR}
              etapas={[
                { label: "Investimento", value: fmtMoney(investimento) },
                { label: "Leads", value: fmtNum(cenarios.mediano.leads) },
                { label: "Qualificados", value: fmtNum(cenarios.mediano.qualificados) },
              ]}
              metricas={[
                { label: "CPL", value: fmtMoney(cenarios.mediano.cpl) },
                { label: "CPLQ", value: fmtMoney(cenarios.mediano.cplq) },
                { label: "Taxa Qualif.", value: fmtPct(cenarios.mediano.taxaQualificacao) },
              ]}
            />
            <FunilVisual
              titulo="Funil Comercial"
              icon={<Handshake className="h-4 w-4" />}
              cor={CO_COLOR}
              etapas={[
                { label: "Cotações", value: fmtNum(cenarios.mediano.cotacoes) },
                { label: "Vendas", value: fmtNum(cenarios.mediano.vendas) },
                { label: "Faturamento", value: fmtMoney(cenarios.mediano.faturamentoLiquido) },
              ]}
              metricas={[
                { label: "Conv. Cot→Venda", value: fmtPct(cenarios.mediano.taxaConv) },
                { label: "Fat. Bruto", value: fmtMoney(cenarios.mediano.faturamentoBruto) },
                { label: "Ticket Médio", value: fmtMoney(cenarios.mediano.ticket) },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* ============ REALIZADO ============ */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" /> Realizado
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Dados reais do período selecionado.</p>
          </div>
          <Select value={realizadoFiltro} onValueChange={(v) => setRealizadoFiltro(v as typeof realizadoFiltro)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15d">Últimos 15 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Marketing realizado */}
            <div className="rounded-lg border-2 p-4" style={{ borderColor: `${MK_COLOR}40` }}>
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-md p-1.5" style={{ background: `${MK_COLOR}20` }}>
                  <Megaphone className="h-4 w-4" style={{ color: MK_COLOR }} />
                </div>
                <h4 className="text-sm font-bold" style={{ color: MK_COLOR }}>Marketing — Realizado</h4>
              </div>
              <div className="space-y-2">
                <RealInput label="Investimento (R$)" value={realizado.investimento} onChange={(v) => setRealizado({ ...realizado, investimento: v })} money />
                <RealInput label="Leads gerados" value={realizado.leads} onChange={(v) => setRealizado({ ...realizado, leads: v })} />
                <RealInput label="Leads qualificados" value={realizado.qualificados} onChange={(v) => setRealizado({ ...realizado, qualificados: v })} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                <Computed label="CPL" value={fmtMoney(realCPL)} />
                <Computed label="CPLQ" value={fmtMoney(realCPLQ)} />
                <Computed label="Tx. Qualif." value={fmtPct(realTaxaQual)} />
              </div>
            </div>

            {/* Comercial realizado */}
            <div className="rounded-lg border-2 p-4" style={{ borderColor: `${CO_COLOR}40` }}>
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-md p-1.5" style={{ background: `${CO_COLOR}20` }}>
                  <Handshake className="h-4 w-4" style={{ color: CO_COLOR }} />
                </div>
                <h4 className="text-sm font-bold" style={{ color: CO_COLOR }}>Comercial — Realizado</h4>
              </div>
              <div className="space-y-2">
                <RealInput label="Cotações enviadas" value={realizado.cotacoes} onChange={(v) => setRealizado({ ...realizado, cotacoes: v })} />
                <RealInput label="Vendas fechadas" value={realizado.vendas} onChange={(v) => setRealizado({ ...realizado, vendas: v })} />
                <RealInput label="Faturamento Bruto (R$)" value={realizado.faturamentoBruto} onChange={(v) => setRealizado({ ...realizado, faturamentoBruto: v })} money />
                <RealInput label="Faturamento Líquido (R$)" value={realizado.faturamentoLiquido} onChange={(v) => setRealizado({ ...realizado, faturamentoLiquido: v })} money />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                <Computed label="Tx. Conversão" value={fmtPct(realTaxaConv)} />
                <Computed label="Ticket Médio" value={fmtMoney(realTicket)} />
              </div>
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-2 text-sm font-medium">Diagnóstico (Realizado vs Cenário Mediano)</p>
            <div className="flex flex-wrap gap-2">
              {diagnostico.map((d) => {
                const cor = d.area === "mk" ? MK_COLOR : CO_COLOR;
                return (
                  <Badge
                    key={d.nome}
                    variant="secondary"
                    className={
                      d.tipo === "alerta"
                        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }
                  >
                    {d.tipo === "alerta" ? (
                      <AlertTriangle className="mr-1 h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    )}
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: cor }} />
                    {d.nome}: {d.area === "co" && d.nome.includes("Faturamento") ? fmtMoney(d.real) : fmtNum(d.real)} / esperado{" "}
                    {d.area === "co" && d.nome.includes("Faturamento") ? fmtMoney(d.esperado) : fmtNum(d.esperado)}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ METAS ============ */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" /> Meta e progresso
          </CardTitle>
          <Select value={metaPeriodo} onValueChange={(v) => setMetaPeriodo(v as typeof metaPeriodo)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Meta Mensal</SelectItem>
              <SelectItem value="trimestre">Meta Trimestral</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-5">
          <MetaBarraGrande
            label="Faturamento"
            cor="rgb(16 185 129)"
            realizado={realizado.faturamentoLiquido}
            meta={metas.faturamento[metaPeriodo]}
            onChangeMeta={(v) => setMetas({ ...metas, faturamento: { ...metas.faturamento, [metaPeriodo]: v } })}
            fmt={fmtMoney}
          />
          <MetaBarraGrande
            label="Leads gerados"
            cor={MK_COLOR}
            realizado={realizado.leads}
            meta={metas.leads[metaPeriodo]}
            onChangeMeta={(v) => setMetas({ ...metas, leads: { ...metas.leads, [metaPeriodo]: v } })}
            fmt={fmtNum}
          />
          <MetaBarraGrande
            label="Leads qualificados"
            cor="rgb(168 85 247)"
            realizado={realizado.qualificados}
            meta={metas.qualificados[metaPeriodo]}
            onChangeMeta={(v) => setMetas({ ...metas, qualificados: { ...metas.qualificados, [metaPeriodo]: v } })}
            fmt={fmtNum}
          />
          <p className="text-xs text-muted-foreground">
            * Layout em modo de visualização. Os valores ainda não são salvos no banco.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// =================== Subcomponentes ===================

function ParamRow({
  label,
  k,
  params,
  onChange,
  suffix,
}: {
  label: string;
  k: keyof ParamsCenario;
  params: Record<Cenario, ParamsCenario>;
  onChange: (cen: Cenario, key: keyof ParamsCenario, v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="mb-2">
      <Label className="text-[11px] text-muted-foreground">{label}{suffix ? ` (${suffix})` : ""}</Label>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {(["pessimista", "mediano", "otimista"] as Cenario[]).map((cen) => {
          const cor = cen === "pessimista" ? "rgb(239 68 68)" : cen === "mediano" ? "rgb(245 158 11)" : "rgb(16 185 129)";
          return (
            <div key={cen} className="relative">
              <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: cor }} />
              <Input
                type="number"
                className="h-8 pl-4 text-xs"
                value={params[cen][k]}
                onChange={(e) => onChange(cen, k, Number(e.target.value) || 0)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CenarioCard({
  nome,
  cor,
  data,
  destaque,
}: {
  nome: string;
  cor: string;
  data: ReturnType<typeof calcCenario>;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-2 p-4 ${destaque ? "ring-2 ring-offset-2" : ""}`}
      style={{ borderColor: cor, background: `${cor}10`, ...(destaque ? { boxShadow: `0 0 0 2px ${cor}30` } : {}) }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>{nome}</span>
        {destaque && <Badge variant="secondary" className="text-[10px]">Esperado</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">Faturamento líquido previsto</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: cor }}>{fmtMoney(data.faturamentoLiquido)}</p>
      <div className="mt-3 space-y-1 text-xs">
        <Linha label="Leads" value={fmtNum(data.leads)} />
        <Linha label="Qualificados" value={fmtNum(data.qualificados)} />
        <Linha label="Vendas" value={fmtNum(data.vendas)} />
        <Linha label="Ticket" value={fmtMoney(data.ticket)} />
      </div>
    </div>
  );
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function FunilVisual({
  titulo,
  icon,
  cor,
  etapas,
  metricas,
}: {
  titulo: string;
  icon: React.ReactNode;
  cor: string;
  etapas: { label: string; value: string }[];
  metricas: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-md p-1.5" style={{ background: `${cor}20`, color: cor }}>
          {icon}
        </div>
        <h4 className="text-sm font-bold" style={{ color: cor }}>{titulo}</h4>
      </div>

      {/* Funil em forma de trapézio */}
      <div className="space-y-1.5">
        {etapas.map((e, i) => {
          const total = etapas.length;
          // Top width 100%, narrowing as we descend
          const topW = 100 - i * (60 / Math.max(1, total - 1));
          const botW = 100 - (i + 1) * (60 / Math.max(1, total - 1));
          // Color shading - top darker
          const opacity = 1 - i * 0.18;
          return (
            <div key={e.label} className="relative flex items-center justify-center" style={{ height: 64 }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <polygon
                  points={`${(100 - topW) / 2},0 ${(100 + topW) / 2},0 ${(100 + botW) / 2},100 ${(100 - botW) / 2},100`}
                  fill={cor}
                  fillOpacity={opacity}
                />
              </svg>
              <div className="relative z-10 flex w-full items-center justify-between px-6 text-white">
                <span className="text-[11px] font-semibold uppercase tracking-wider drop-shadow">{e.label}</span>
                <span className="text-base font-bold drop-shadow">{e.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Métricas embaixo */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
        {metricas.map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="text-sm font-semibold" style={{ color: cor }}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RealInput({ label, value, onChange, money }: { label: string; value: number; onChange: (v: number) => void; money?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="h-8 w-32 text-right text-sm"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        {money && <span className="text-[10px] text-muted-foreground">R$</span>}
      </div>
    </div>
  );
}

function Computed({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function MetaBarraGrande({
  label,
  cor,
  realizado,
  meta,
  onChangeMeta,
  fmt,
}: {
  label: string;
  cor: string;
  realizado: number;
  meta: number;
  onChangeMeta: (v: number) => void;
  fmt: (v: number) => string;
}) {
  const p = pct(realizado, meta);
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: cor }} />
          <h4 className="text-sm font-semibold">{label}</h4>
        </div>
        <span className="text-lg font-bold" style={{ color: cor }}>{p}%</span>
      </div>
      <div className="relative h-6 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${p}%`, background: `linear-gradient(90deg, ${cor}cc, ${cor})` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Realizado: <strong className="text-foreground">{fmt(realizado)}</strong></span>
        <div className="flex items-center gap-2">
          <span>Meta:</span>
          <Input
            type="number"
            className="h-7 w-28"
            value={meta}
            onChange={(e) => onChangeMeta(Number(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );
}
