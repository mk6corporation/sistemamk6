import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listModelos, upsertModelo, deleteModelo } from "@/lib/contratos.functions";

export const Route = createFileRoute("/_authenticated/contratos/modelos")({
  component: ModelosPage,
});

function ModelosPage() {
  const qc = useQueryClient();
  const list = useServerFn(listModelos);
  const up = useServerFn(upsertModelo);
  const del = useServerFn(deleteModelo);

  const q = useQuery({ queryKey: ["contrato-modelos"], queryFn: () => list() });
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", corpo: "", ativo: true });

  const selected = q.data?.find((m) => m.id === sel);

  function load(id: string | null) {
    setSel(id);
    if (!id) { setForm({ nome: "", descricao: "", corpo: "", ativo: true }); return; }
    const m = q.data?.find((x) => x.id === id);
    if (m) setForm({ nome: m.nome, descricao: m.descricao ?? "", corpo: m.corpo ?? "", ativo: m.ativo });
  }

  const save = useMutation({
    mutationFn: () => up({ data: { id: sel, nome: form.nome, descricao: form.descricao, corpo: form.corpo, ativo: form.ativo } }),
    onSuccess: (r) => {
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: ["contrato-modelos"] });
      setSel(r.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const remover = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["contrato-modelos"] });
      load(null);
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Library className="h-6 w-6" />Modelos de Contrato</h1>
          <p className="text-sm text-muted-foreground">Cadastre modelos reutilizáveis. Use variáveis como {"{{nome_cliente}}"}, {"{{valor}}"}, {"{{data}}"}.</p>
        </div>
        <Button onClick={() => load(null)} variant={sel ? "outline" : "default"}>
          <Plus className="mr-2 h-4 w-4" />Novo modelo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <Card className="p-2">
          <div className="space-y-1">
            {q.data?.map((m) => (
              <button
                key={m.id}
                onClick={() => load(m.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${sel === m.id ? "bg-muted font-medium" : ""}`}
              >
                {m.nome}
                {!m.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
              </button>
            ))}
            {q.data?.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhum modelo ainda</div>}
          </div>
        </Card>

        <Card className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Prestação de Serviços - Padrão" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Corpo do contrato *</Label>
            <Textarea
              value={form.corpo}
              onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
              rows={20}
              className="font-mono text-sm"
              placeholder="CLÁUSULA 1ª - DO OBJETO&#10;O presente contrato tem por objeto..."
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
              Ativo
            </label>
            <div className="flex gap-2">
              {sel && (
                <Button variant="outline" onClick={() => confirm("Excluir modelo?") && remover.mutate(sel)}>
                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                </Button>
              )}
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nome.trim()}>
                <Save className="mr-2 h-4 w-4" />Salvar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
