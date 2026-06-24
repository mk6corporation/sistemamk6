import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, FileText, Trash2, ExternalLink, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listContratos, upsertContrato, deleteContrato } from "@/lib/contratos.functions";

export const Route = createFileRoute("/_authenticated/contratos/")({
  component: ContratosIndex,
});

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-200 text-gray-800",
  enviado: "bg-blue-100 text-blue-800",
  assinado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

function ContratosIndex() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listContratos);
  const create = useServerFn(upsertContrato);
  const del = useServerFn(deleteContrato);

  const q = useQuery({ queryKey: ["contratos"], queryFn: () => list() });

  const novo = useMutation({
    mutationFn: () => create({ data: { titulo: "Novo contrato", corpo: "" } }),
    onSuccess: (r) => navigate({ to: "/contratos/$id", params: { id: r.id } }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const remover = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">Gerencie contratos, modelos e assinaturas.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/contratos/modelos"><Library className="mr-2 h-4 w-4" />Modelos</Link>
          </Button>
          <Button onClick={() => novo.mutate()} disabled={novo.isPending}>
            <Plus className="mr-2 h-4 w-4" />Novo contrato
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">Título</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Signatário</th>
              <th className="p-3">Status</th>
              <th className="p-3">Atualizado</th>
              <th className="p-3 w-[120px]"></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td className="p-4 text-muted-foreground" colSpan={6}>Carregando…</td></tr>
            )}
            {q.data?.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={6}>Nenhum contrato. Clique em "Novo contrato".</td></tr>
            )}
            {q.data?.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <Link to="/contratos/$id" params={{ id: c.id }} className="flex items-center gap-2 font-medium hover:underline">
                    <FileText className="h-4 w-4 text-muted-foreground" />{c.titulo}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{c.cliente_nome ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{c.signatario_nome ?? c.signatario_email ?? "—"}</td>
                <td className="p-3">
                  <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                </td>
                <td className="p-3 text-muted-foreground">{new Date(c.updated_at).toLocaleString("pt-BR")}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/contratos/$id" params={{ id: c.id }}><ExternalLink className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm("Excluir este contrato?")) remover.mutate(c.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
