import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Repeat,
  CalendarClock,
  TrendingUp,
  Search,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-renovacao")({
  component: AdminRenovacao,
});

type Cliente = {
  id: string;
  nome: string;
  categoria: string | null;
  plano: string | null;
  fim_contrato: string | null;
  resultado_renovacao: string | null;
  valor_mensal: number | null;
  removido_em: string | null;
  operacional: Array<{ id?: string; name?: string }> | null;
  estagio: string | null;
};

type Equipe = {
  cliente_id: string;
  gestor_nome: string | null;
  cs_nome: string | null;
  vendedor_nome: string | null;
};

function classifyResultado(v: string | null): "renovou" | "nao_renovou" | "indefinido" {
  if (!v) return "indefinido";
  const s = v.toLowerCase();
  if (s.includes("não") || s.includes("nao") || s.includes("churn") || s.includes("cancel"))
    return "nao_renovou";
  if (s.includes("renov") || s.includes("upsell") || s.includes("sim")) return "renovou";
  return "indefinido";
}

function diasParaVencer(fim: string | null, hoje: Date): number | null {
  if (!fim) return null;
  return Math.floor((new Date(fim).getTime() - hoje.getTime()) / 86400000);
}

function bucketize(dias: number | null): "vencido" | "30" | "60" | "90" | "futuro" | null {
  if (dias === null) return null;
  if (dias < 0) return "vencido";
  if (dias <= 30) return "30";
  if (dias <= 60) return "60";
  if (dias <= 90) return "90";
  return "futuro";
}

function AdminRenovacao() {
  const { user } = useAuth();
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data: roleCheck, isLoading: roleLoading } = useQuery({
    enabled: !!user,
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return (data ?? []).some((r) => r.role === "admin");
    },
  });

  const clientesQuery = useQuery({
    enabled: !!roleCheck,
    queryKey: ["renovacao-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(
          "id,nome,categoria,plano,fim_contrato,resultado_renovacao,valor_mensal,removido_em,operacional,estagio",
        );
      if (error) throw error;
      return ((data ?? []) as Cliente[]).filter((c) => !c.removido_em);
    },
  });

  const equipeQuery = useQuery({
    enabled: !!roleCheck,
    queryKey: ["renovacao-equipe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipe_comercial_cliente")
        .select("cliente_id,gestor_nome,cs_nome,vendedor_nome");
      if (error) throw error;
      return (data ?? []) as Equipe[];
    },
  });

  const equipeByCliente = useMemo(() => {
    const m = new Map<string, Equipe>();
    (equipeQuery.data ?? []).forEach((e) => m.set(e.cliente_id, e));
    return m;
  }, [equipeQuery.data]);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroGestor, setFiltroGestor] = useState("todos");
  const [filtroCs, setFiltroCs] = useState("todos");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroPlano, setFiltroPlano] = useState("todos");
  const [filtroBucket, setFiltroBucket] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const ativos = useMemo(
    () => (clientesQuery.data ?? []).filter((c) => c.categoria === "ATIVO"),
    [clientesQuery.data],
  );

  const opcoes = useMemo(() => {
    const gestores = new Set<string>();
    const css = new Set<string>();
    const vendedores = new Set<string>();
    const planos = new Set<string>();
    (clientesQuery.data ?? []).forEach((c) => {
      if (c.plano) planos.add(c.plano);
      const eq = equipeByCliente.get(c.id);
      if (eq?.gestor_nome) gestores.add(eq.gestor_nome);
      if (eq?.cs_nome) css.add(eq.cs_nome);
      if (eq?.vendedor_nome) vendedores.add(eq.vendedor_nome);
    });
    return {
      gestores: Array.from(gestores).sort(),
      css: Array.from(css).sort(),
      vendedores: Array.from(vendedores).sort(),
      planos: Array.from(planos).sort(),
    };
  }, [clientesQuery.data, equipeByCliente]);

  function aplicaFiltros(c: Cliente): boolean {
    const eq = equipeByCliente.get(c.id);
    if (filtroGestor !== "todos" && eq?.gestor_nome !== filtroGestor) return false;
    if (filtroCs !== "todos" && eq?.cs_nome !== filtroCs) return false;
    if (filtroVendedor !== "todos" && eq?.vendedor_nome !== filtroVendedor) return false;
    if (filtroPlano !== "todos" && c.plano !== filtroPlano) return false;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      if (!c.nome.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  // Vencimentos (ATIVOS + futuro)
  const vencimentos = useMemo(() => {
    return ativos
      .filter(aplicaFiltros)
      .map((c) => {
        const dias = diasParaVencer(c.fim_contrato, hoje);
        const bucket = bucketize(dias);
        return { cliente: c, dias, bucket };
      })
      .filter((v) => v.bucket !== null && v.bucket !== "futuro")
      .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ativos,
    hoje,
    equipeByCliente,
    filtroGestor,
    filtroCs,
    filtroVendedor,
    filtroPlano,
    busca,
  ]);

  const vencimentosFiltrados = useMemo(() => {
    if (filtroBucket === "todos") return vencimentos;
    return vencimentos.filter((v) => v.bucket === filtroBucket);
  }, [vencimentos, filtroBucket]);

  // KPIs por janela
  const kpis = useMemo(() => {
    const b = { vencido: 0, "30": 0, "60": 0, "90": 0 };
    let mrrEmRisco = 0;
    vencimentos.forEach((v) => {
      if (v.bucket && v.bucket !== "futuro") {
        b[v.bucket as keyof typeof b] += 1;
        if (v.bucket !== "vencido" || (v.dias ?? -999) > -30) {
          mrrEmRisco += v.cliente.valor_mensal ?? 0;
        }
      }
    });
    return { ...b, mrrEmRisco };
  }, [vencimentos]);

  // Taxa de renovação histórica (clientes com fim_contrato passado, com resultado preenchido)
  const taxaRenovacao = useMemo(() => {
    const todos = (clientesQuery.data ?? []).filter(aplicaFiltros);
    const decididos = todos.filter((c) => {
      if (!c.fim_contrato) return false;
      const d = diasParaVencer(c.fim_contrato, hoje);
      if (d === null || d > 0) return false; // só passados
      return classifyResultado(c.resultado_renovacao) !== "indefinido";
    });
    const renovou = decididos.filter(
      (c) => classifyResultado(c.resultado_renovacao) === "renovou",
    ).length;
    const naoRenovou = decididos.filter(
      (c) => classifyResultado(c.resultado_renovacao) === "nao_renovou",
    ).length;
    const total = decididos.length;
    const taxa = total > 0 ? Math.round((renovou / total) * 100) : 0;
    return { renovou, naoRenovou, total, taxa };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clientesQuery.data,
    hoje,
    equipeByCliente,
    filtroGestor,
    filtroCs,
    filtroVendedor,
    filtroPlano,
    busca,
  ]);

  // Ranking por gestor + CS (taxa de renovação)
  type RankRow = { nome: string; renovou: number; nao: number; total: number; taxa: number };
  function ranking(key: "gestor_nome" | "cs_nome" | "vendedor_nome"): RankRow[] {
    const m = new Map<string, { renovou: number; nao: number; total: number }>();
    (clientesQuery.data ?? []).filter(aplicaFiltros).forEach((c) => {
      const dias = diasParaVencer(c.fim_contrato, hoje);
      if (dias === null || dias > 0) return;
      const cls = classifyResultado(c.resultado_renovacao);
      if (cls === "indefinido") return;
      const eq = equipeByCliente.get(c.id);
      const nome = (eq?.[key] as string | null) ?? "(Sem responsável)";
      const cur = m.get(nome) ?? { renovou: 0, nao: 0, total: 0 };
      cur.total += 1;
      if (cls === "renovou") cur.renovou += 1;
      else cur.nao += 1;
      m.set(nome, cur);
    });
    return Array.from(m.entries())
      .map(([nome, v]) => ({
        nome,
        renovou: v.renovou,
        nao: v.nao,
        total: v.total,
        taxa: v.total > 0 ? Math.round((v.renovou / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  const rankGestor = useMemo(
    () => ranking("gestor_nome"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientesQuery.data, equipeByCliente, hoje, filtroGestor, filtroCs, filtroVendedor, filtroPlano, busca],
  );
  const rankCs = useMemo(
    () => ranking("cs_nome"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientesQuery.data, equipeByCliente, hoje, filtroGestor, filtroCs, filtroVendedor, filtroPlano, busca],
  );
  const rankVendedor = useMemo(
    () => ranking("vendedor_nome"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientesQuery.data, equipeByCliente, hoje, filtroGestor, filtroCs, filtroVendedor, filtroPlano, busca],
  );

  if (roleLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!roleCheck) return <Navigate to="/" />;

  const loading = clientesQuery.isLoading || equipeQuery.isLoading;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Repeat className="h-6 w-6 text-primary" /> Funil de Renovação
        </h1>
        <p className="text-sm text-muted-foreground">
          Vencimentos, taxa de renovação e desempenho por gestor, CS e vendedor.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-[220px] pl-8"
            />
          </div>
          <Select value={filtroGestor} onValueChange={setFiltroGestor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Gestor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os gestores</SelectItem>
              {opcoes.gestores.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroCs} onValueChange={setFiltroCs}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="CS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os CS</SelectItem>
              {opcoes.css.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {opcoes.vendedores.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os planos</SelectItem>
              {opcoes.planos.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* KPIs de janela */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiBucket
          label="Vencidos"
          value={kpis.vencido}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          tone="red"
          active={filtroBucket === "vencido"}
          onClick={() => setFiltroBucket(filtroBucket === "vencido" ? "todos" : "vencido")}
        />
        <KpiBucket
          label="Vencem em 30 dias"
          value={kpis["30"]}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          tone="amber"
          active={filtroBucket === "30"}
          onClick={() => setFiltroBucket(filtroBucket === "30" ? "todos" : "30")}
        />
        <KpiBucket
          label="31–60 dias"
          value={kpis["60"]}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          tone="blue"
          active={filtroBucket === "60"}
          onClick={() => setFiltroBucket(filtroBucket === "60" ? "todos" : "60")}
        />
        <KpiBucket
          label="61–90 dias"
          value={kpis["90"]}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          tone="indigo"
          active={filtroBucket === "90"}
          onClick={() => setFiltroBucket(filtroBucket === "90" ? "todos" : "90")}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Taxa de renovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold ${
                taxaRenovacao.taxa >= 50 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {taxaRenovacao.taxa}%
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {taxaRenovacao.renovou} de {taxaRenovacao.total} contratos decididos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de vencimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Próximos vencimentos
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({vencimentosFiltrados.length} cliente
              {vencimentosFiltrados.length === 1 ? "" : "s"})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : vencimentosFiltrados.length === 0 ? (
            <p className="px-6 pb-6 text-center text-sm text-muted-foreground">
              Nenhum contrato no recorte selecionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>CS</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Fim</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vencimentosFiltrados.map(({ cliente, dias, bucket }) => {
                  const eq = equipeByCliente.get(cliente.id);
                  return (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/clientes/$clienteId"
                          params={{ clienteId: cliente.id }}
                          className="text-primary hover:underline"
                        >
                          {cliente.nome}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cliente.plano ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{eq?.gestor_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{eq?.cs_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{eq?.vendedor_nome ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {cliente.fim_contrato
                          ? new Date(cliente.fim_contrato).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={bucketBadge(bucket)}>
                          {bucket === "vencido"
                            ? `${Math.abs(dias ?? 0)}d vencido`
                            : `em ${dias}d`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RankingCard title="Renovação por Gestor" rows={rankGestor} />
        <RankingCard title="Renovação por CS" rows={rankCs} />
        <RankingCard title="Renovação por Vendedor" rows={rankVendedor} />
      </div>
    </div>
  );
}

function KpiBucket({
  label,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "red" | "amber" | "blue" | "indigo";
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    indigo: "text-indigo-600",
  };
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer transition-colors hover:bg-accent/40 ${
        active ? "ring-2 ring-primary" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function bucketBadge(b: "vencido" | "30" | "60" | "90" | "futuro" | null) {
  if (b === "vencido")
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (b === "30")
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (b === "60")
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
}

function RankingCard({
  title,
  rows,
}: {
  title: string;
  rows: { nome: string; renovou: number; nao: number; total: number; taxa: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Sem dados decididos ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.nome} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{r.nome}</span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      r.taxa >= 50 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {r.taxa}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${r.taxa >= 50 ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${r.taxa}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {r.renovou} renovou · {r.nao} não · {r.total} total
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
