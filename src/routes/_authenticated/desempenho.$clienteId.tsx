import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { PerformanceFunil } from "@/components/cliente/performance-funil";

export const Route = createFileRoute("/_authenticated/desempenho/$clienteId")({
  component: DesempenhoCliente,
});

function DesempenhoCliente() {
  const { clienteId } = Route.useParams();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente-desempenho", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, categoria, estagio")
        .eq("id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/desempenho">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao ranking
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando cliente...
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border bg-gradient-to-r from-primary/10 via-amber-500/5 to-blue-500/10 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{cliente?.nome ?? "Cliente"}</h1>
              <p className="text-xs text-muted-foreground">
                Desempenho mensal · pronto para apresentação ao cliente
              </p>
            </div>
          </div>

          <PerformanceFunil clienteId={clienteId} />
        </>
      )}
    </div>
  );
}
