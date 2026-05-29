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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { classifyNps, scoreBadgeClasses, type NpsResposta } from "@/lib/nps-utils";

export const Route = createFileRoute("/_authenticated/nps/detratores")({
  component: NpsDetratoresPage,
});

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function NpsDetratoresPage() {
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  const respostasQuery = useQuery({
    queryKey: ["nps-detratores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_nps")
        .select("*")
        .lte("score", 6)
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
        .select("id,nome,plano,operacional");
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientesById = useMemo(() => {
    const m = new Map<
      string,
      {
        id: string;
        nome: string;
        plano: string | null;
        operacional: Array<{ id: string; name: string }> | null;
      }
    >();
    for (const c of clientesQuery.data ?? [])
      m.set(c.id, c as any);
    return m;
  }, [clientesQuery.data]);

  const produtos = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientesQuery.data ?? []) if (c.plano) set.add(c.plano);
    return Array.from(set).sort();
  }, [clientesQuery.data]);

  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const r of respostasQuery.data ?? []) {
      const d = new Date(r.respondido_em);
      set.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`);
    }
    return Array.from(set).sort().reverse();
  }, [respostasQuery.data]);

  const filtradas = useMemo(() => {
    return (respostasQuery.data ?? []).filter((r) => {
      const c = clientesById.get(r.cliente_id);
      if (filtroProduto !== "todos" && c?.plano !== filtroProduto) return false;
      if (filtroMes !== "todos") {
        const d = new Date(r.respondido_em);
        const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        if (k !== filtroMes) return false;
      }
      return true;
    });
  }, [respostasQuery.data, filtroProduto, filtroMes, clientesById]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <AlertTriangle className="h-7 w-7 text-red-600" />
            Detratores
          </h1>
          <p className="text-sm text-muted-foreground">
            Clientes com nota ≤ 6 — pontos de atenção para recuperação.
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
            <span className="text-sm font-medium text-muted-foreground">Mês de referência:</span>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {meses.map((k) => {
                  const [y, m] = k.split("-").map(Number);
                  return (
                    <SelectItem key={k} value={k}>{MESES_PT[m]} / {y}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {filtradas.length} detrator{filtradas.length === 1 ? "" : "es"}
          </div>
        </div>

        {/* Lista */}
        {respostasQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum detrator no período selecionado. 🎉
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtradas.map((r) => {
              const c = clientesById.get(r.cliente_id);
              const ops = (c?.operacional ?? []).map((o) => o.name).join(", ");
              return (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={scoreBadgeClasses(r.score)}>
                        NPS {r.score}
                      </Badge>
                      <Link
                        to="/clientes/$clienteId"
                        params={{ clienteId: r.cliente_id }}
                        className="text-base font-semibold hover:underline"
                      >
                        {c?.nome ?? "—"}
                      </Link>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(r.respondido_em).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {ops && <>{ops} · </>}
                      {c?.plano ?? "—"}
                    </CardDescription>
                  </CardHeader>
                  {r.comentario && (
                    <CardContent>
                      <p className="rounded-md bg-muted/40 p-3 text-sm text-foreground">
                        "{r.comentario}"
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
