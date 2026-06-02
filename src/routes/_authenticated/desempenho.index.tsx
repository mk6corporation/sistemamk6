import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, TrendingUp, Trophy, ArrowRight, Calendar } from "lucide-react";
import { fmtBRL, fmtInt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/desempenho/")({
  component: DesempenhoIndex,
});

type ProjecaoLinha = {
  id: string;
  cliente_id: string;
  ano: number;
  mes: number;
  investimento: number;
  realizado: {
    leads?: number;
    qualificados?: number;
    vendas?: number;
    faturamentoBruto?: number;
    faturamentoLiquido?: number;
    investimento?: number;
  } | null;
  clientes: { id: string; nome: string } | null;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function DesempenhoIndex() {
  const navigate = useNavigate();
  const now = new Date();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<"mes_atual" | "todos">("todos");

  const { data: projecoes, isLoading } = useQuery({
    queryKey: ["desempenho-ranking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projecoes_cliente")
        .select("id, cliente_id, ano, mes, investimento, realizado, clientes:cliente_id ( id, nome )")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjecaoLinha[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .is("removido_em", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filtragem por período + agregação por cliente
  const ranking = useMemo(() => {
    if (!projecoes) return [];
    const filtrado =
      periodo === "mes_atual"
        ? projecoes.filter((p) => p.ano === now.getFullYear() && p.mes === now.getMonth() + 1)
        : projecoes;

    // Agrupar por cliente — somar realizados
    const map = new Map<
      string,
      {
        cliente_id: string;
        nome: string;
        faturamento: number;
        investimento: number;
        leads: number;
        vendas: number;
        periodos: number;
        ultima: { ano: number; mes: number };
      }
    >();
    for (const p of filtrado) {
      const nome = p.clientes?.nome ?? "Cliente";
      const fat = Number(p.realizado?.faturamentoLiquido ?? 0);
      const inv = Number(p.realizado?.investimento ?? p.investimento ?? 0);
      const leads = Number(p.realizado?.leads ?? 0);
      const vendas = Number(p.realizado?.vendas ?? 0);
      const cur = map.get(p.cliente_id);
      if (cur) {
        cur.faturamento += fat;
        cur.investimento += inv;
        cur.leads += leads;
        cur.vendas += vendas;
        cur.periodos += 1;
        // mais recente
        if (p.ano > cur.ultima.ano || (p.ano === cur.ultima.ano && p.mes > cur.ultima.mes)) {
          cur.ultima = { ano: p.ano, mes: p.mes };
        }
      } else {
        map.set(p.cliente_id, {
          cliente_id: p.cliente_id,
          nome,
          faturamento: fat,
          investimento: inv,
          leads,
          vendas,
          periodos: 1,
          ultima: { ano: p.ano, mes: p.mes },
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.faturamento - a.faturamento);
  }, [projecoes, periodo, now]);

  const rankingFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ranking;
    return ranking.filter((r) => r.nome.toLowerCase().includes(q));
  }, [ranking, busca]);

  const topRoas = useMemo(() => {
    return [...rankingFiltrado]
      .filter((r) => r.investimento > 0)
      .sort((a, b) => b.faturamento / b.investimento - a.faturamento / a.investimento)[0];
  }, [rankingFiltrado]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TrendingUp className="h-6 w-6 text-primary" /> Desempenho do cliente
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranking dos clientes com melhores resultados. Selecione um cliente abaixo para abrir o funil de desempenho dele (apto para apresentar em reunião).
        </p>
      </div>

      {/* Seleção de cliente */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5" /> Abrir funil de um cliente específico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <Select onValueChange={(v) => navigate({ to: "/desempenho/$clienteId", params: { clienteId: v } })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground">ou busque pelo ranking abaixo</span>
          </div>
        </CardContent>
      </Card>

      {/* Filtros do ranking */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente no ranking..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os períodos</SelectItem>
            <SelectItem value="mes_atual">{MESES[now.getMonth()]}/{now.getFullYear()}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ranking */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando ranking...
        </div>
      ) : rankingFiltrado.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma projeção encontrada{busca ? ` para "${busca}"` : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rankingFiltrado.map((r, i) => {
            const roas = r.investimento > 0 ? r.faturamento / r.investimento : 0;
            const isTop = i === 0;
            const isBest = topRoas?.cliente_id === r.cliente_id;
            return (
              <Link
                key={r.cliente_id}
                to="/desempenho/$clienteId"
                params={{ clienteId: r.cliente_id }}
                className="block"
              >
                <Card
                  className={`group transition hover:-translate-y-0.5 hover:shadow-md ${
                    isTop ? "border-2 border-amber-400/50 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20" : ""
                  }`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold ${
                        isTop ? "bg-amber-400 text-amber-950" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isTop ? <Trophy className="h-5 w-5" /> : `#${i + 1}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{r.nome}</h3>
                        {isBest && (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            Melhor ROAS
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {r.periodos} {r.periodos === 1 ? "mês" : "meses"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Última projeção: {MESES[r.ultima.mes - 1]}/{r.ultima.ano}
                      </p>
                    </div>
                    <div className="hidden gap-6 sm:flex">
                      <Metric label="Faturamento" value={fmtBRL(r.faturamento)} cor="text-emerald-600" destaque />
                      <Metric label="Investido" value={fmtBRL(r.investimento)} />
                      <Metric label="ROAS" value={roas > 0 ? `${roas.toFixed(2)}x` : "—"} cor={roas >= 3 ? "text-emerald-600" : roas >= 1 ? "text-amber-600" : "text-red-600"} />
                      <Metric label="Vendas" value={fmtInt(r.vendas)} />
                      <Metric label="Leads" value={fmtInt(r.leads)} />
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                  {/* Métricas no mobile */}
                  <div className="grid grid-cols-3 gap-2 border-t px-4 py-2 sm:hidden">
                    <Metric label="Faturamento" value={fmtBRL(r.faturamento)} cor="text-emerald-600" />
                    <Metric label="Vendas" value={fmtInt(r.vendas)} />
                    <Metric label="ROAS" value={roas > 0 ? `${roas.toFixed(2)}x` : "—"} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, cor, destaque }: { label: string; value: string; cor?: string; destaque?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tabular-nums ${destaque ? "text-base font-bold" : "text-sm font-semibold"} ${cor ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
