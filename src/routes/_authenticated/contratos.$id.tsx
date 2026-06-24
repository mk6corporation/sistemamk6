import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Save, Send, Copy, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getContrato, upsertContrato, enviarContrato, cancelarContrato, listModelos } from "@/lib/contratos.functions";

export const Route = createFileRoute("/_authenticated/contratos/$id")({
  component: ContratoEditor,
});

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-200 text-gray-800",
  enviado: "bg-blue-100 text-blue-800",
  assinado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

function ContratoEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const get = useServerFn(getContrato);
  const up = useServerFn(upsertContrato);
  const enviar = useServerFn(enviarContrato);
  const cancelar = useServerFn(cancelarContrato);
  const lModelos = useServerFn(listModelos);

  const q = useQuery({ queryKey: ["contrato", id], queryFn: () => get({ data: { id } }) });
  const modelos = useQuery({ queryKey: ["contrato-modelos"], queryFn: () => lModelos() });

  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data ?? []));
  }, []);

  const [form, setForm] = useState({
    cliente_id: "" as string,
    modelo_id: "" as string,
    titulo: "",
    corpo: "",
    signatario_nome: "",
    signatario_email: "",
    signatario_documento: "",
    observacoes: "",
  });

  useEffect(() => {
    if (q.data) {
      setForm({
        cliente_id: q.data.cliente_id ?? "",
        modelo_id: q.data.modelo_id ?? "",
        titulo: q.data.titulo,
        corpo: q.data.corpo ?? "",
        signatario_nome: q.data.signatario_nome ?? "",
        signatario_email: q.data.signatario_email ?? "",
        signatario_documento: q.data.signatario_documento ?? "",
        observacoes: q.data.observacoes ?? "",
      });
    }
  }, [q.data]);

  const readonly = q.data?.status === "assinado" || q.data?.status === "cancelado";

  const save = useMutation({
    mutationFn: () => up({ data: { id, ...form, cliente_id: form.cliente_id || null, modelo_id: form.modelo_id || null } }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["contrato", id] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const send = useMutation({
    mutationFn: () => enviar({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato enviado para assinatura");
      qc.invalidateQueries({ queryKey: ["contrato", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const cancel = useMutation({
    mutationFn: () => cancelar({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato cancelado");
      qc.invalidateQueries({ queryKey: ["contrato", id] });
    },
  });

  const aplicarModelo = (mid: string) => {
    const m = modelos.data?.find((x) => x.id === mid);
    if (!m) return;
    setForm((f) => ({ ...f, modelo_id: mid, corpo: m.corpo, titulo: f.titulo || m.nome }));
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = q.data?.token_publico ? `${baseUrl}/contrato/assinar/${q.data.token_publico}` : null;

  // Preview com variáveis substituídas
  const preview = useMemo(() => {
    const c = clientes.find((x) => x.id === form.cliente_id);
    return form.corpo
      .replaceAll("{{nome_cliente}}", c?.nome ?? "____________")
      .replaceAll("{{signatario}}", form.signatario_nome || "____________")
      .replaceAll("{{documento}}", form.signatario_documento || "____________")
      .replaceAll("{{data}}", new Date().toLocaleDateString("pt-BR"));
  }, [form, clientes]);

  if (q.isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (q.isError) return <div className="p-6 text-destructive">Erro ao carregar</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/contratos" })}>
            <ArrowLeft className="mr-1 h-4 w-4" />Voltar
          </Button>
          <h1 className="text-2xl font-semibold">{form.titulo || "Contrato"}</h1>
          {q.data && <Badge className={STATUS_COLORS[q.data.status]}>{q.data.status}</Badge>}
        </div>
        <div className="flex gap-2">
          {!readonly && (
            <>
              <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="mr-2 h-4 w-4" />Salvar
              </Button>
              {q.data?.status === "rascunho" && (
                <Button onClick={async () => { await save.mutateAsync(); send.mutate(); }} disabled={send.isPending || !form.titulo}>
                  <Send className="mr-2 h-4 w-4" />Enviar para assinatura
                </Button>
              )}
              {q.data?.status === "enviado" && (
                <Button variant="outline" onClick={() => cancel.mutate()}>
                  <Ban className="mr-2 h-4 w-4" />Cancelar envio
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {link && (
        <Card className="flex items-center gap-3 border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/30">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <div className="text-sm font-medium">Link público de assinatura</div>
            <code className="text-xs text-muted-foreground break-all">{link}</code>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <Copy className="mr-1 h-3 w-3" />Copiar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={link} target="_blank" rel="noopener">Abrir</a>
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-4 p-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} disabled={readonly} />
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.cliente_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, cliente_id: v === "none" ? "" : v }))} disabled={readonly}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem cliente —</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aplicar modelo</Label>
              <Select value={form.modelo_id || "none"} onValueChange={(v) => v !== "none" && aplicarModelo(v)} disabled={readonly}>
                <SelectTrigger><SelectValue placeholder="Escolher modelo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nenhum —</SelectItem>
                  {modelos.data?.filter((m) => m.ativo).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label>Signatário</Label>
              <Input value={form.signatario_nome} onChange={(e) => setForm((f) => ({ ...f, signatario_nome: e.target.value }))} disabled={readonly} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.signatario_email} onChange={(e) => setForm((f) => ({ ...f, signatario_email: e.target.value }))} disabled={readonly} />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input value={form.signatario_documento} onChange={(e) => setForm((f) => ({ ...f, signatario_documento: e.target.value }))} disabled={readonly} />
            </div>
          </div>

          <div>
            <Label>Corpo do contrato (cláusulas editáveis)</Label>
            <Textarea
              value={form.corpo}
              onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
              rows={24}
              className="font-mono text-sm"
              disabled={readonly}
              placeholder="Use variáveis: {{nome_cliente}}, {{signatario}}, {{documento}}, {{data}}"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Variáveis disponíveis: <code>{"{{nome_cliente}}"}</code>, <code>{"{{signatario}}"}</code>, <code>{"{{documento}}"}</code>, <code>{"{{data}}"}</code>
            </p>
          </div>

          <div>
            <Label>Observações internas</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} disabled={readonly} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Pré-visualização</div>
            <div className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs">
              {preview || "(vazio)"}
            </div>
          </Card>

          {q.data?.assinaturas && q.data.assinaturas.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold">Evidências de assinatura</div>
              {q.data.assinaturas.map((a: any) => (
                <div key={a.id} className="space-y-1 border-t pt-2 text-xs">
                  <div><b>{a.nome_completo}</b> {a.documento && `— ${a.documento}`}</div>
                  {a.email && <div className="text-muted-foreground">{a.email}</div>}
                  <div className="text-muted-foreground">IP: {a.ip ?? "—"}</div>
                  <div className="text-muted-foreground">Em: {new Date(a.created_at).toLocaleString("pt-BR")}</div>
                  {a.documento_hash && <div className="break-all text-muted-foreground">Hash: <code>{a.documento_hash.slice(0, 24)}…</code></div>}
                  {a.assinatura_imagem && <img src={a.assinatura_imagem} alt="assinatura" className="mt-2 max-h-24 rounded border bg-white" />}
                  {a.assinatura_texto && <div className="mt-2 italic">"{a.assinatura_texto}"</div>}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
