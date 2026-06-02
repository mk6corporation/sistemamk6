import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientesBase,
});

type OperacionalMember = { id?: string; name?: string };

type Cliente = {
  id: string;
  nome: string;
  estagio: string | null;
  categoria: string | null;
  plano: string | null;
  valor_mensal: number | null;
  inicio_contrato: string | null;
  removido_em: string | null;
  operacional: OperacionalMember[] | null;
};

function normalize(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const CATEGORIA_STYLE: Record<string, string> = {
  ATIVO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  PAUSADO: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  CHURN: "bg-red-500/15 text-red-700 border-red-500/30",
  FINALIZADO: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ClientesBase() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState<string>("TODOS");
  const [tipoPlano, setTipoPlano] = useState<"TODOS" | "ACELERACAO" | "DEMAIS">("TODOS");
  const [scope, setScope] = useState<"meus" | "todos">("meus");

  const { data: viewer } = useQuery({
    enabled: !!user,
    queryKey: ["viewer-scope", user?.id],
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("nome,email").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      return { nome: profile?.nome ?? null, email: profile?.email ?? null, isAdmin };
    },
  });

  // Admin default: ver todos. Colaborador: sempre "meus".
  const effectiveScope: "meus" | "todos" = viewer?.isAdmin ? scope : "meus";

  // Admin entra vendo todos por padrão
  useEffect(() => {
    if (viewer?.isAdmin) setScope("todos");
  }, [viewer?.isAdmin]);


  const { data, isLoading } = useQuery({
    queryKey: ["clientes-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome,estagio,categoria,plano,valor_mensal,inicio_contrato,removido_em,operacional")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const allClientes = data ?? [];

  const clientes = useMemo(() => {
    if (!viewer) return [];
    if (effectiveScope === "todos") return allClientes;
    const myName = normalize(viewer.nome);
    if (!myName) return [];
    return allClientes.filter((c) =>
      (c.operacional ?? []).some((m) => normalize(m?.name).includes(myName) || myName.includes(normalize(m?.name)))
    );
  }, [allClientes, viewer, effectiveScope]);


  const categorias = useMemo(() => {
    const set = new Set<string>();
    allClientes.forEach((c) => {
      if (c.categoria) set.add(c.categoria);
    });
    return ["TODOS", ...Array.from(set).sort()];
  }, [allClientes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientes.filter((c) => {
      if (categoria !== "TODOS" && c.categoria !== categoria) return false;
      const planoNorm = normalize(c.plano);
      const isAceleracao = planoNorm.includes("aceleracao");
      if (tipoPlano === "ACELERACAO" && !isAceleracao) return false;
      if (tipoPlano === "DEMAIS" && isAceleracao) return false;
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        (c.estagio ?? "").toLowerCase().includes(q) ||
        (c.plano ?? "").toLowerCase().includes(q)
      );
    });
  }, [clientes, query, categoria, tipoPlano]);

  const aceleracaoCount = useMemo(
    () => clientes.filter((c) => normalize(c.plano).includes("aceleracao")).length,
    [clientes],
  );



  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            Clientes — Base
          </h1>
          <p className="text-sm text-muted-foreground">
            Pesquise e acesse a ficha 360º de qualquer cliente.
          </p>
        </div>
        {viewer?.isAdmin && (
          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setScope("meus")}
              className={`rounded px-3 py-1.5 transition-colors ${
                effectiveScope === "meus"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Meus clientes
            </button>
            <button
              type="button"
              onClick={() => setScope("todos")}
              className={`rounded px-3 py-1.5 transition-colors ${
                effectiveScope === "todos"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Todos (admin)
            </button>
          </div>
        )}
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, estágio, plano..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoria(cat)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    categoria === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : `${filtered.length} de ${clientes.length} cliente(s)`}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead>Início</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link
                          to="/clientes/$clienteId"
                          params={{ clienteId: c.id }}
                          className="hover:underline"
                        >
                          {c.nome}
                          {c.removido_em && (
                            <span className="ml-2 text-xs text-muted-foreground">(removido)</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {c.categoria ? (
                          <Badge
                            variant="outline"
                            className={CATEGORIA_STYLE[c.categoria] ?? ""}
                          >
                            {c.categoria}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.estagio ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.plano ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatBRL(c.valor_mensal)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.inicio_contrato
                          ? new Date(c.inicio_contrato).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
