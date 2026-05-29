import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { triggerNotionSync, triggerFinanceiroSync } from "@/lib/sync.functions";
import { enriquecerTodosCnpjs } from "@/lib/cnpj.functions";
import { migrarJourney } from "@/lib/journey.functions";

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
  CalendarClock,
  RotateCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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


export const Route = createFileRoute("/_authenticated/")({
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
  fim_contrato: string | null;
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
  ATIVO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  PAUSADO: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  CHURN: "bg-red-500/15 text-red-700 border-red-500/30",
  FINALIZADO: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  OUTRO: "bg-zinc-500/10 text-muted-foreground border-border",
};

const TIPO_LABEL: Record<string, { label: string; icon: any; className: string }> = {
  novo_cliente: { label: "Novo cliente", icon: UserPlus, className: "text-emerald-600" },
  churn: { label: "Churn", icon: TrendingDown, className: "text-red-600" },
  pausou: { label: "Pausou", icon: PauseCircle, className: "text-amber-600" },
  finalizou: { label: "Finalizou", icon: Flag, className: "text-blue-600" },
  recuperou: { label: "Recuperou", icon: Sparkles, className: "text-emerald-600" },
  mudanca_estagio: { label: "Mudança de estágio", icon: ArrowRightLeft, className: "text-muted-foreground" },
  removido_do_notion: { label: "Removido do Notion", icon: Trash2, className: "text-red-500" },
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
  const financeiroFn = useServerFn(triggerFinanceiroSync);
  const enriquecerFn = useServerFn(enriquecerTodosCnpjs);
  const migrarFn = useServerFn(migrarJourney);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastFinanceiro, setLastFinanceiro] = useState<any>(null);
  const [lastCnpj, setLastCnpj] = useState<any>(null);

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

  const financeiroMutation = useMutation({
    mutationFn: (force: boolean) => financeiroFn({ data: { force } }),
    onSuccess: (data) => {
      setLastFinanceiro(data);
      qc.invalidateQueries();
    },
  });

  const cnpjMutation = useMutation({
    mutationFn: () => enriquecerFn(),
    onSuccess: (data) => {
      setLastCnpj(data);
      qc.invalidateQueries();
    },
  });

  // Auto-migração do Journey (1x por sessão)
  const migrouRef = useRef(false);
  useEffect(() => {
    if (migrouRef.current) return;
    migrouRef.current = true;
    migrarFn().then(() => qc.invalidateQueries({ queryKey: ["gargalos"] })).catch(() => {});
  }, [migrarFn, qc]);

  const gargalosQuery = useQuery({
    queryKey: ["gargalos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("ordem,status,tem_trava,cliente_entregue,acao_mk6_itens,atrasado,pronto_para_avancar,bloqueado")
        .neq("status", "concluido")
        .eq("bloqueado", false);
      if (error) throw error;
      const rows = data ?? [];
      const congestion: Record<number, number> = {};
      let bolaMk6 = 0, bolaCliente = 0, atrasados = 0, prontos = 0;
      for (const r of rows) {
        congestion[r.ordem] = (congestion[r.ordem] ?? 0) + 1;
        const itens = Array.isArray(r.acao_mk6_itens) ? (r.acao_mk6_itens as any[]) : [];
        const acaoOk = itens.length === 0 || itens.every((i) => i.concluido);
        if (!acaoOk) bolaMk6 += 1;
        else if (r.tem_trava && !r.cliente_entregue) bolaCliente += 1;
        if (r.atrasado) atrasados += 1;
        if (r.pronto_para_avancar) prontos += 1;
      }
      const top = Object.entries(congestion)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([ordem, n]) => ({ ordem: Number(ordem), n }));
      return { bolaMk6, bolaCliente, atrasados, prontos, top, total: rows.length };
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

  const renovacoesQuery = useQuery({
    queryKey: ["renovacoes-contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id,cliente_id,tipo,inicio_contrato,fim_contrato,fee_mensal,valor_total,created_at")
        .eq("tipo", "renovacao")
        .order("inicio_contrato", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
    const todas = mudancasQuery.data ?? [];
    return mesesUltimos12.map(({ key, labelCurto, date }) => {
      const snap = snapshotAt(date);
      const ano = date.getFullYear();
      const mIdx = date.getMonth();
      let churn = 0;
      let finalizou = 0;
      let novos = 0;
      for (const m of todas) {
        const dt = new Date(m.detectada_em);
        if (dt.getFullYear() !== ano || dt.getMonth() !== mIdx) continue;
        if (filtroOperacional !== "todos" && !idsClientesFiltrados.has(m.notion_page_id)) continue;
        if (m.tipo_mudanca === "churn") churn += 1;
        else if (m.tipo_mudanca === "finalizou") finalizou += 1;
        else if (m.tipo_mudanca === "novo_cliente") novos += 1;
      }
      return { key, label: labelCurto, ...snap, churn, finalizou, novos };
    });
  }, [mesesUltimos12, snapshotAt, mudancasQuery.data, filtroOperacional, idsClientesFiltrados]);


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

  // ===== Diário do mês selecionado: entradas vs saídas =====
  const diarioMes = useMemo(() => {
    const mes = comparacaoMes.mes;
    const ano = mes.date.getFullYear();
    const mIdx = mes.date.getMonth();
    const ultimoDia = new Date(ano, mIdx + 1, 0).getDate();

    // bucket por dia
    const dias: { dia: number; label: string; entradas: number; saidas: number; saldo: number; acumulado: number }[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      dias.push({ dia: d, label: String(d).padStart(2, "0"), entradas: 0, saidas: 0, saldo: 0, acumulado: 0 });
    }

    const todas = mudancasQuery.data ?? [];
    for (const m of todas) {
      const dt = new Date(m.detectada_em);
      if (dt.getFullYear() !== ano || dt.getMonth() !== mIdx) continue;
      if (filtroOperacional !== "todos" && !idsClientesFiltrados.has(m.notion_page_id)) continue;
      const dia = dt.getDate();
      const bucket = dias[dia - 1];
      if (!bucket) continue;
      if (m.tipo_mudanca === "novo_cliente" || m.tipo_mudanca === "restaurado_no_notion") {
        bucket.entradas += 1;
      } else if (
        m.tipo_mudanca === "churn" ||
        m.tipo_mudanca === "finalizou" ||
        m.tipo_mudanca === "removido_do_notion"
      ) {
        bucket.saidas += 1;
      }
    }
    let acc = 0;
    for (const d of dias) {
      d.saldo = d.entradas - d.saidas;
      acc += d.saldo;
      d.acumulado = acc;
    }
    return dias;
  }, [comparacaoMes, mudancasQuery.data, filtroOperacional, idsClientesFiltrados]);

  // ===== Série diária do mês selecionado (snapshot por dia + acumulados) =====
  const diarioMensal = useMemo(() => {
    const mes = comparacaoMes.mes;
    const ano = mes.date.getFullYear();
    const mIdx = mes.date.getMonth();
    const ultimoDia = new Date(ano, mIdx + 1, 0).getDate();
    const hoje = new Date();
    const ehMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mIdx;
    const limiteDia = ehMesAtual ? hoje.getDate() : ultimoDia;

    const todas = mudancasQuery.data ?? [];
    const pontos: Array<{
      label: string;
      ativos: number;
      outros: number;
      acelPro: number;
      churn: number;
      finalizou: number;
    }> = [];

    let churnAcum = 0;
    let finalAcum = 0;

    for (let d = 1; d <= limiteDia; d++) {
      // snapshot ao fim do dia d
      const fimDoDia = new Date(ano, mIdx, d, 23, 59, 59, 999);
      const snap = snapshotAt(fimDoDia);

      // acumula churn/finalizou ocorridos neste dia
      for (const m of todas) {
        const dt = new Date(m.detectada_em);
        if (dt.getFullYear() !== ano || dt.getMonth() !== mIdx || dt.getDate() !== d) continue;
        if (filtroOperacional !== "todos" && !idsClientesFiltrados.has(m.notion_page_id)) continue;
        if (m.tipo_mudanca === "churn") churnAcum += 1;
        else if (m.tipo_mudanca === "finalizou") finalAcum += 1;
      }

      pontos.push({
        label: String(d).padStart(2, "0"),
        ativos: snap.ativos,
        outros: snap.outros,
        acelPro: snap.acelPro,
        churn: churnAcum,
        finalizou: finalAcum,
      });
    }
    return pontos;
  }, [comparacaoMes, snapshotAt, mudancasQuery.data, filtroOperacional, idsClientesFiltrados]);

  const diarioTotais = useMemo(() => {
    let entradas = 0, saidas = 0;
    for (const d of diarioMes) { entradas += d.entradas; saidas += d.saidas; }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [diarioMes]);

  // ===== Projetos a vencer (mês atual do filtro + mês seguinte) =====
  const vencimentos = useMemo(() => {
    const mes = comparacaoMes.mes.date;
    const anoAtual = mes.getFullYear();
    const mesAtual = mes.getMonth();
    const anoProx = mesAtual === 11 ? anoAtual + 1 : anoAtual;
    const mesProx = (mesAtual + 1) % 12;

    const labelAtual = formatMes(mes);
    const labelProx = formatMes(new Date(anoProx, mesProx, 1));

    type Item = Cliente & { _fim: Date };
    const noMes: Item[] = [];
    const noProx: Item[] = [];

    for (const c of clientesFiltrados) {
      if (!c.fim_contrato) continue;
      // tratar como data local (YYYY-MM-DD)
      const [y, m, d] = c.fim_contrato.split("-").map(Number);
      if (!y || !m || !d) continue;
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() === anoAtual && dt.getMonth() === mesAtual) {
        noMes.push({ ...c, _fim: dt });
      } else if (dt.getFullYear() === anoProx && dt.getMonth() === mesProx) {
        noProx.push({ ...c, _fim: dt });
      }
    }
    noMes.sort((a, b) => a._fim.getTime() - b._fim.getTime());
    noProx.sort((a, b) => a._fim.getTime() - b._fim.getTime());
    return { noMes, noProx, labelAtual, labelProx };
  }, [clientesFiltrados, comparacaoMes]);


  // ===== Renovações do mês selecionado =====
  const renovacoesDoMes = useMemo(() => {
    const mes = comparacaoMes.mes.date;
    const ano = mes.getFullYear();
    const mIdx = mes.getMonth();
    const contratos = renovacoesQuery.data ?? [];
    const clientesById = new Map(clientesFiltrados.map((c) => [c.id, c]));
    const idsPermitidos = new Set(clientesFiltrados.map((c) => c.id));

    const itens = contratos
      .filter((r) => {
        if (!r.cliente_id || !idsPermitidos.has(r.cliente_id)) return false;
        let y: number | undefined, m: number | undefined, d: number | undefined;
        if (r.inicio_contrato) {
          [y, m, d] = r.inicio_contrato.split("-").map(Number);
        } else if (r.created_at) {
          const dt = new Date(r.created_at);
          y = dt.getFullYear();
          m = dt.getMonth() + 1;
          d = dt.getDate();
        }
        if (!y || !m || !d) return false;
        if (y !== ano || m - 1 !== mIdx) return false;
        return true;
      })
      .map((r) => {
        const cliente = clientesById.get(r.cliente_id!);
        const [iy, im, id] = (r.inicio_contrato ?? "").split("-").map(Number);
        const [fy, fm, fd] = (r.fim_contrato ?? "").split("-").map(Number);
        return {
          id: r.id,
          clienteId: r.cliente_id!,
          nome: cliente?.nome ?? "—",
          operacional: cliente?.operacional ?? [],
          inicio: iy ? new Date(iy, im - 1, id) : null,
          fim: fy ? new Date(fy, fm - 1, fd) : null,
          fee: r.fee_mensal,
          valorTotal: r.valor_total,
        };
      })
      .sort((a, b) => (a.inicio?.getTime() ?? 0) - (b.inicio?.getTime() ?? 0));

    return itens;
  }, [renovacoesQuery.data, clientesFiltrados, comparacaoMes]);


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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="lg">
              {mutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sincronizando...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Sincronizar agora</>
              )}
            </Button>
            <Button
              onClick={() => financeiroMutation.mutate(true)}
              disabled={financeiroMutation.isPending}
              size="lg"
              variant="outline"
            >
              {financeiroMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Importar formulários (CNPJ, contratos)</>
              )}
            </Button>
            <Button
              onClick={() => cnpjMutation.mutate()}
              disabled={cnpjMutation.isPending}
              size="lg"
              variant="outline"
            >
              {cnpjMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Consultando BrasilAPI...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Enriquecer CNPJs (BrasilAPI)</>
              )}
            </Button>
          </div>
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

        {lastFinanceiro && (
          <div className="space-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Formulários do financeiro:</span>
              <span>{lastFinanceiro.clientes_com_formulario} importados</span>
              <span>· {lastFinanceiro.clientes_sem_formulario} sem formulário</span>
              {lastFinanceiro.erros > 0 && (
                <span className="text-red-600">· {lastFinanceiro.erros} erros</span>
              )}
            </div>
            {lastFinanceiro.erros_detalhe && lastFinanceiro.erros_detalhe.length > 0 && (
              <ul className="ml-7 list-disc space-y-1 text-xs text-red-700">
                {lastFinanceiro.erros_detalhe.map((e: { cliente: string; mensagem: string }, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{e.cliente}:</span> {e.mensagem}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {lastCnpj && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">BrasilAPI:</span>
            <span>{lastCnpj.processados} CNPJs consultados</span>
            <span>· {lastCnpj.preenchidos} clientes enriquecidos</span>
            <span className="text-muted-foreground">· {lastCnpj.semCnpj} sem CNPJ</span>
            {lastCnpj.invalidos > 0 && <span className="text-amber-600">· {lastCnpj.invalidos} inválidos</span>}
            {lastCnpj.erros > 0 && <span className="text-red-600">· {lastCnpj.erros} erros</span>}
          </div>
        )}

        {/* Gargalos da Jornada */}
        {gargalosQuery.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gargalos da Jornada (MK6)</CardTitle>
              <CardDescription>
                {gargalosQuery.data.total} clientes ativos na jornada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-md border bg-emerald-500/5 p-3">
                  <p className="text-xs text-muted-foreground">Bola com MK6</p>
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{gargalosQuery.data.bolaMk6}</p>
                </div>
                <div className="rounded-md border bg-amber-500/5 p-3">
                  <p className="text-xs text-muted-foreground">Aguardando cliente</p>
                  <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">{gargalosQuery.data.bolaCliente}</p>
                </div>
                <div className="rounded-md border bg-red-500/5 p-3">
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                  <p className="text-2xl font-semibold text-red-700 dark:text-red-300">{gargalosQuery.data.atrasados}</p>
                </div>
                <div className="rounded-md border bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">Prontos p/ avançar</p>
                  <p className="text-2xl font-semibold text-primary">{gargalosQuery.data.prontos}</p>
                </div>
              </div>
              {gargalosQuery.data.top.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Steps mais congestionados:</span>
                  {gargalosQuery.data.top.map((t) => (
                    <Badge key={t.ordem} variant="secondary">Step {t.ordem} · {t.n}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
            accent="blue"
            icon={TrendingUp}
            comparacao={{ inicio: comparacaoMes.inicio.outros, fim: comparacaoMes.fim.outros, ehMesAtual: comparacaoMes.ehMesAtual }}
          />
          <KpiCard
            label="Aceleração Turismo Pro"
            value={kpis.aceleracaoPro}
            accent="violet"
            icon={Sparkles}
            comparacao={{ inicio: comparacaoMes.inicio.acelPro, fim: comparacaoMes.fim.acelPro, ehMesAtual: comparacaoMes.ehMesAtual }}
          />
          {(() => {
            const delta = comparacaoMes.fim.ativos - comparacaoMes.inicio.ativos;
            const sign = delta > 0 ? "+" : "";
            return (
              <KpiCard
                label={`Variação em ${comparacaoMes.mes.label}`}
                value={`${sign}${delta}`}
                accent={delta >= 0 ? "emerald" : "red"}
                icon={delta >= 0 ? TrendingUp : TrendingDown}
              />
            );
          })()}
          <KpiCard label="Pausados" value={kpis.counts.PAUSADO} accent="amber" icon={PauseCircle} />
          <KpiCard
            label={`Churn em ${comparacaoMes.mes.label}`}
            value={evolucaoMensal.find((m) => m.key === comparacaoMes.mes.key)?.churn ?? 0}
            accent="red"
            icon={TrendingDown}
          />
          <KpiCard
            label={`Finalizados em ${comparacaoMes.mes.label}`}
            value={evolucaoMensal.find((m) => m.key === comparacaoMes.mes.key)?.finalizou ?? 0}
            accent="blue"
            icon={Flag}
          />
          <KpiCard label="Aviso de Churn" value={kpis.avisoChurn} accent="amber" icon={AlertCircle} />
          <RenovacoesKpi mesLabel={comparacaoMes.mes.label} itens={renovacoesDoMes} />
          <KpiCard label="MRR (ativos)" value={formatMoney(kpis.mrr)} accent="emerald" icon={Sparkles} />
        </div>

        <div className="w-full space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Evolução diária — {comparacaoMes.mes.label}</CardTitle>
              </div>
              <CardDescription>
                Snapshot de ativos por dia do mês selecionado. Churn e Projetos finalizados são
                acumulados ao longo do mês (resetam no dia 01).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={diarioMensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(l) => `Dia ${l}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="ativos" name="Ativos (total)" stroke="#047857" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="outros" name="Jorney + Outros" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="acelPro" name="Aceleração Turismo Pro" stroke="#6d28d9" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="churn" name="Churn" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="finalizou" name="Projetos finalizados" stroke="#b45309" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 3 }} />
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
                    <TableHead className="text-right">Novos</TableHead>
                    <TableHead className="text-right">Churn</TableHead>
                    <TableHead className="text-right">Finalizados</TableHead>
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
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {m.novos > 0 ? `+${m.novos}` : m.novos}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {m.churn > 0 ? `−${m.churn}` : m.churn}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600">
                          {m.finalizou > 0 ? `−${m.finalizou}` : m.finalizou}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Projetos a vencer */}
        <div className="grid gap-4 lg:grid-cols-2">
          <VencimentosCard
            title={`Vencem em ${vencimentos.labelAtual}`}
            description="Clientes cujo projeto vence no mês selecionado no filtro."
            itens={vencimentos.noMes}
            accent="amber"
          />
          <VencimentosCard
            title={`Vencem em ${vencimentos.labelProx}`}
            description="Clientes cujo projeto vence no mês seguinte."
            itens={vencimentos.noProx}
            accent="blue"
          />
        </div>

      </div>
    </div>
  );
}

function VencimentosCard({
  title,
  description,
  itens,
  accent,
}: {
  title: string;
  description: string;
  itens: Array<Cliente & { _fim: Date }>;
  accent: "amber" | "blue";
}) {
  const accentCls =
    accent === "amber"
      ? "text-amber-600 bg-amber-500/10"
      : "text-blue-600 bg-blue-500/10";
  const [filtro, setFiltro] = useState<"todos" | "ativo" | "pausado" | "churn">("todos");

  const pausados = itens.filter((c) =>
    (c.estagio ?? "").toLowerCase().includes("pausad"),
  ).length;
  const churn = itens.filter((c) =>
    (c.estagio ?? "").toLowerCase().includes("churn"),
  ).length;
  const ativos = itens.length - pausados - churn;
  const totalSemPausa = ativos + churn;

  const itensFiltrados = itens.filter((c) => {
    const est = (c.estagio ?? "").toLowerCase();
    const isPausado = est.includes("pausad");
    const isChurn = est.includes("churn");
    if (filtro === "pausado") return isPausado;
    if (filtro === "churn") return isChurn;
    if (filtro === "ativo") return !isPausado && !isChurn;
    return true;
  });

  const toggle = (v: "ativo" | "pausado" | "churn") =>
    setFiltro((f) => (f === v ? "todos" : v));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-2 ${accentCls}`}>
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge
              variant="secondary"
              title="Total (ativos + churn, exclui pausados)"
              role="button"
              onClick={() => setFiltro("todos")}
              className={`cursor-pointer ${filtro === "todos" ? "ring-2 ring-primary" : ""}`}
            >
              {totalSemPausa}
            </Badge>
            <Badge
              variant="outline"
              role="button"
              onClick={() => toggle("ativo")}
              className={`cursor-pointer border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ${filtro === "ativo" ? "ring-2 ring-emerald-500" : ""}`}
              title="Apenas ativos"
            >
              {ativos} ativo{ativos === 1 ? "" : "s"}
            </Badge>
            <Badge
              variant="outline"
              role="button"
              onClick={() => toggle("pausado")}
              className={`cursor-pointer border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 ${filtro === "pausado" ? "ring-2 ring-amber-500" : ""}`}
              title="Apenas pausados"
            >
              {pausados} pausad{pausados === 1 ? "o" : "os"}
            </Badge>
            <Badge
              variant="outline"
              role="button"
              onClick={() => toggle("churn")}
              className={`cursor-pointer border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 ${filtro === "churn" ? "ring-2 ring-red-500" : ""}`}
              title="Apenas churn"
            >
              {churn} churn
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {itensFiltrados.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhum cliente neste recorte.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Operacional</TableHead>
                <TableHead>Estágio</TableHead>
                <TableHead className="text-right">Vencimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensFiltrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: c.id }}
                      className="hover:underline"
                    >
                      {c.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(c.operacional ?? []).map((o) => o.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <EstagioSelect clienteId={c.id} estagio={c.estagio} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c._fim.toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
  accent: "emerald" | "red" | "amber" | "blue" | "violet";
  icon: any;
  comparacao?: { inicio: number; fim: number; ehMesAtual: boolean };
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    red: "text-red-600 bg-red-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    blue: "text-blue-600 bg-blue-500/10",
    violet: "text-violet-600 bg-violet-500/10",
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

const ESTAGIO_OPCOES = ["Cliente", "Pausado", "Churn"] as const;

function estagioBadgeClass(estagio: string | null | undefined) {
  const e = (estagio ?? "").toLowerCase();
  if (e.includes("pausad")) return CATEGORIA_STYLE.PAUSADO;
  if (e.includes("churn") && !e.includes("aviso")) return CATEGORIA_STYLE.CHURN;
  if (e.includes("finaliz")) return CATEGORIA_STYLE.FINALIZADO;
  if (!estagio) return CATEGORIA_STYLE.OUTRO;
  return CATEGORIA_STYLE.ATIVO;
}

function EstagioSelect({ clienteId, estagio }: { clienteId: string; estagio: string | null }) {
  const queryClient = useQueryClient();
  const current = estagio ?? "Cliente";
  const options = ESTAGIO_OPCOES.includes(current as any)
    ? [...ESTAGIO_OPCOES]
    : [current, ...ESTAGIO_OPCOES];

  const mutation = useMutation({
    mutationFn: async (novo: string) => {
      const { error } = await supabase
        .from("clientes")
        .update({ estagio: novo })
        .eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-vencimento"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-base"] });
      queryClient.invalidateQueries();
    },
  });

  return (
    <Select
      value={current}
      onValueChange={(v) => v !== current && mutation.mutate(v)}
      disabled={mutation.isPending}
    >
      <SelectTrigger
        className={`h-7 w-auto min-w-[110px] gap-1 rounded-full border px-2.5 py-0 text-xs font-medium ${estagioBadgeClass(current)}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="text-xs">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


type RenovacaoItem = {
  id: string;
  clienteId: string;
  nome: string;
  operacional: Array<{ id: string; name: string; avatar_url: string | null }>;
  inicio: Date | null;
  fim: Date | null;
  fee: number | null;
  valorTotal: number | null;
};

function RenovacoesKpi({ mesLabel, itens }: { mesLabel: string; itens: RenovacaoItem[] }) {
  const [open, setOpen] = useState(false);
  const total = itens.length;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-left">
          <Card className="cursor-pointer transition hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-md p-2 text-violet-600 bg-violet-500/10">
                <RotateCw className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  Renovações em {mesLabel}
                </p>
                <p className="text-2xl font-semibold tabular-nums">{total}</p>
              </div>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Renovações em {mesLabel}</DialogTitle>
          <DialogDescription>
            Clientes que renovaram o contrato no mês selecionado.
          </DialogDescription>
        </DialogHeader>
        {total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma renovação registrada neste mês.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Operacional</TableHead>
                  <TableHead className="text-right">Início</TableHead>
                  <TableHead className="text-right">Fim</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/clientes/$clienteId"
                        params={{ clienteId: r.clienteId }}
                        className="hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        {r.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.operacional.map((o) => o.name).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {r.inicio ? r.inicio.toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {r.fim ? r.fim.toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatMoney(r.fee)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



