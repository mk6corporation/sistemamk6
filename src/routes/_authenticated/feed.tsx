import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Loader2,
  TrendingDown,
  PauseCircle,
  Flag,
  UserPlus,
  ArrowRightLeft,
  Trash2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

type Cliente = {
  id: string;
  notion_page_id: string;
  nome: string;
  operacional: Array<{ id: string; name: string; avatar_url: string | null }> | null;
  removido_em: string | null;
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

function formatData(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function FeedPage() {
  const [filtroOperacional, setFiltroOperacional] = useState<string>("todos");

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
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

  const ativos = (clientesQuery.data ?? []).filter((c) => !c.removido_em);

  const operacionais = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of ativos) {
      for (const op of c.operacional ?? []) {
        if (op?.id && op?.name) map.set(op.id, op.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [ativos]);

  const idsFiltrados = useMemo(() => {
    if (filtroOperacional === "todos") return null;
    return new Set(
      ativos
        .filter((c) => (c.operacional ?? []).some((op) => op.id === filtroOperacional))
        .map((c) => c.notion_page_id),
    );
  }, [ativos, filtroOperacional]);

  const feedPorMes = useMemo(() => {
    const lista = (mudancasQuery.data ?? []).filter(
      (m) =>
        TIPOS_RELEVANTES.has(m.tipo_mudanca) &&
        (idsFiltrados ? idsFiltrados.has(m.notion_page_id) : true),
    );
    const buckets = new Map<string, Mudanca[]>();
    for (const m of lista) {
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
  }, [mudancasQuery.data, idsFiltrados]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feed de mudanças</h1>
            <p className="text-sm text-muted-foreground">
              Histórico mensal de eventos relevantes dos clientes.
            </p>
          </div>
          <Select value={filtroOperacional} onValueChange={setFiltroOperacional}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filtrar por operacional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os operacionais</SelectItem>
              {operacionais.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

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
      </div>
    </div>
  );
}
