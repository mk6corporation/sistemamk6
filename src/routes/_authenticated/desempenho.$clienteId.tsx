import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, TrendingUp, Calendar } from "lucide-react";
import { PerformanceFunil } from "@/components/cliente/performance-funil";
import { ComercialDashboard } from "@/components/cliente/comercial-dashboard";
import { VendedoresFunilSelector, type SelectionMode } from "@/components/cliente/vendedores-funil-selector";
import { useState } from "react";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
] as const;

export const Route = createFileRoute("/_authenticated/desempenho/$clienteId")({
  component: DesempenhoCliente,
});

function DesempenhoCliente() {
  const { clienteId } = Route.useParams();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [vendedorMode, setVendedorMode] = useState<SelectionMode>("macro");

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

  const anos = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/desempenho">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao ranking
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando cliente...
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-gradient-to-r from-primary/10 via-amber-500/5 to-blue-500/10 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="mr-auto">
              <h1 className="text-xl font-bold">{cliente?.nome ?? "Cliente"}</h1>
              <p className="text-xs text-muted-foreground">
                Desempenho mensal · pronto para apresentação ao cliente
              </p>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Mês</Label>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger className="h-9 w-36 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((nome, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ano</Label>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger className="h-9 w-24 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seletor Macro / Vendedor ao lado do filtro de mês */}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Visão do desempenho — {MESES[mes - 1]}/{ano}
              </span>
            </div>
            <VendedoresFunilSelector
              clienteId={clienteId}
              ano={ano}
              mes={mes}
              mode={vendedorMode}
              onChange={(mode) => setVendedorMode(mode)}
            />
          </div>

          <ComercialDashboard clienteId={clienteId} ano={ano} mes={mes} selecaoVendedor={vendedorMode} />

          <PerformanceFunil clienteId={clienteId} />
        </>
      )}
    </div>
  );
}
