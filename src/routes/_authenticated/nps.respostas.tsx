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
import { Loader2, MessageSquare, Search } from "lucide-react";
import {
  classifyNps,
  scoreBadgeClasses,
  type NpsResposta,
} from "@/lib/nps-utils";

export const Route = createFileRoute("/_authenticated/nps/respostas")({
  component: NpsRespostasPage,
});

function NpsRespostasPage() {
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const respostasQuery = useQuery({
    queryKey: ["nps-respostas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_nps")
        .select("*")
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
        .select("id,nome,plano");
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientesById = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; plano: string | null }>();
    for (const c of clientesQuery.data ?? []) m.set(c.id, c);
    return m;
  }, [clientesQuery.data]);

  const produtos = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientesQuery.data ?? []) {
      if (c.plano) set.add(c.plano);
    }
    return Array.from(set).sort();
  }, [clientesQuery.data]);

  const respostasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (respostasQuery.data ?? []).filter((r) => {
      const c = clientesById.get(r.cliente_id);
      if (filtroTipo !== "todos" && classifyNps(r.score) !== filtroTipo) return false;
      if (filtroProduto !== "todos" && c?.plano !== filtroProduto) return false;
      if (q) {
        const hay = `${c?.nome ?? ""} ${r.comentario ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [respostasQuery.data, filtroTipo, filtroProduto, busca, clientesById]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Respostas de NPS</h1>
          <p className="text-sm text-muted-foreground">
            Todas as respostas recebidas (promotores, neutros e detratores).
          </p>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou comentário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-[280px] pl-8"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="promotor">Promotores (9–10)</SelectItem>
              <SelectItem value="neutro">Neutros (7–8)</SelectItem>
              <SelectItem value="detrator">Detratores (0–6)</SelectItem>
            </SelectContent>
          </Select>
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
          <div className="ml-auto text-sm text-muted-foreground">
            {respostasFiltradas.length} resposta{respostasFiltradas.length === 1 ? "" : "s"}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <MessageSquare className="mr-2 inline h-4 w-4" />
              Histórico de respostas
            </CardTitle>
            <CardDescription>Ordenado da mais recente para a mais antiga.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {respostasQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : respostasFiltradas.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Nenhuma resposta encontrada.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Nota</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Comentário</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respostasFiltradas.map((r) => {
                    const c = clientesById.get(r.cliente_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="outline" className={scoreBadgeClasses(r.score)}>
                            NPS {r.score}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            to="/clientes/$clienteId"
                            params={{ clienteId: r.cliente_id }}
                            className="hover:underline"
                          >
                            {c?.nome ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c?.plano ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-md text-sm">
                          {r.comentario ? (
                            <span className="text-muted-foreground">"{r.comentario}"</span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {new Date(r.respondido_em).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
