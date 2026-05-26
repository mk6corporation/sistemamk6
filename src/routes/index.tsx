import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotionSync } from "@/lib/sync.functions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  component: SyncTestPage,
});

const CATEGORIA_VARIANT: Record<string, string> = {
  ATIVO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PAUSADO: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  CHURN: "bg-red-500/15 text-red-700 dark:text-red-400",
  FINALIZADO: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400",
  OUTRO: "bg-zinc-500/10 text-muted-foreground",
};

function SyncTestPage() {
  const qc = useQueryClient();
  const syncFn = useServerFn(triggerNotionSync);
  const [lastResult, setLastResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ["sync_runs"] });
      qc.invalidateQueries({ queryKey: ["clientes_summary"] });
    },
  });

  const runsQuery = useQuery({
    queryKey: ["sync_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_runs")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["clientes_summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("categoria");
      if (error) throw error;
      const counts: Record<string, number> = {
        ATIVO: 0,
        PAUSADO: 0,
        CHURN: 0,
        FINALIZADO: 0,
        OUTRO: 0,
      };
      for (const c of data ?? []) {
        const key = (c.categoria as string) ?? "OUTRO";
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return { total: data?.length ?? 0, counts };
    },
  });

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">MK6 — Sincronização Notion</h1>
          <p className="text-muted-foreground">
            Painel temporário de teste da Fase 2. Use o botão abaixo para puxar os clientes do
            Notion e popular o banco interno.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Executar sincronização</CardTitle>
            <CardDescription>
              Lê todas as linhas do database <span className="font-mono">Banco de Dados - Clientes</span>{" "}
              no Notion, faz upsert e registra mudanças de estágio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              size="lg"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar agora
                </>
              )}
            </Button>

            {lastResult && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {lastResult.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  Último resultado: {lastResult.status}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-muted-foreground">
                  <div>
                    <div className="text-xs uppercase">Processados</div>
                    <div className="text-lg font-semibold text-foreground">
                      {lastResult.clientes_processados}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase">Novos</div>
                    <div className="text-lg font-semibold text-foreground">
                      {lastResult.clientes_novos}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase">Mudanças</div>
                    <div className="text-lg font-semibold text-foreground">
                      {lastResult.mudancas_detectadas}
                    </div>
                  </div>
                </div>
                {lastResult.erro && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-red-600">
                    {lastResult.erro}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo atual</CardTitle>
            <CardDescription>Snapshot dos clientes salvos no banco interno</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  Total: {summaryQuery.data?.total ?? 0}
                </Badge>
                {Object.entries(summaryQuery.data?.counts ?? {}).map(([k, v]) => (
                  <Badge
                    key={k}
                    className={`text-sm ${CATEGORIA_VARIANT[k] ?? CATEGORIA_VARIANT.OUTRO}`}
                  >
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            {runsQuery.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (runsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sincronização ainda.</p>
            ) : (
              <div className="space-y-2">
                {runsQuery.data!.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border bg-muted/20 p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      {r.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : r.status === "error" ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      <span>{new Date(r.iniciado_em).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>{r.clientes_processados} processados</span>
                      <span>+{r.clientes_novos} novos</span>
                      <span>{r.mudancas_detectadas} mudanças</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
