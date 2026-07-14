import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { ArrowLeft, Save, Send, Copy, Ban, CheckCircle2, Wand2, MessageCircle, Eye, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getContrato, upsertContrato, enviarContrato, cancelarContrato, listModelos, assinarComoAdmin } from "@/lib/contratos.functions";

export const Route = createFileRoute("/_authenticated/contratos/$id")({
  component: ContratoEditor,
});

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-200 text-gray-800",
  enviado: "bg-blue-100 text-blue-800",
  assinado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

type Vars = Record<string, string>;

const CLIENTE_FIELDS: { key: string; label: string }[] = [
  { key: "cliente_nome_completo", label: "Nome completo do responsável" },
  { key: "cliente_cpf", label: "CPF" },
  { key: "cliente_email", label: "E-mail" },
  { key: "cliente_razao_social", label: "Razão social" },
  { key: "cliente_cnpj", label: "CNPJ" },
  { key: "cliente_endereco", label: "Endereço comercial (com CEP)" },
  { key: "cliente_whatsapp", label: "WhatsApp (envio de cobranças)" },
];

const QR_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "qr_servico_incluso", label: "(i) Serviço Incluso" },
  { key: "qr_preco_total", label: "(ii) Preço Total", placeholder: "R$ 12.500,00" },
  { key: "qr_forma_pagamento", label: "(iii) Forma de Pagamento", placeholder: "À vista / Parcelado 3x…" },
  { key: "qr_metodo_pagamento", label: "(iv) Método de Pagamento", placeholder: "Cartão de crédito / PIX / Boleto" },
  { key: "qr_primeiro_vencimento", label: "(v) Primeiro Vencimento", placeholder: "DD/MM/AAAA" },
  { key: "qr_obs_pagamento", label: "(vi) Obs. Pagamento" },
  { key: "qr_inicio_servico", label: "(vii) Início do Serviço", placeholder: "DD/MM/AAAA" },
  { key: "qr_duracao_servico", label: "(viii) Duração do Serviço", placeholder: "3 (três) meses" },
];

function renderVars(body: string, vars: Vars, extra: Vars = {}): string {
  const all = { ...vars, ...extra };
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (all[k] ?? "").toString() || `__________`);
}

function ContratoEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const get = useServerFn(getContrato);
  const up = useServerFn(upsertContrato);
  const enviar = useServerFn(enviarContrato);
  const cancelar = useServerFn(cancelarContrato);
  const lModelos = useServerFn(listModelos);
  const adminSign = useServerFn(assinarComoAdmin);

  const q = useQuery({ queryKey: ["contrato", id], queryFn: () => get({ data: { id } }) });
  const modelos = useQuery({ queryKey: ["contrato-modelos"], queryFn: () => lModelos() });

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminNome, setAdminNome] = useState("");
  const [adminDoc, setAdminDoc] = useState("");
  const sigRef = useRef<SignatureCanvas | null>(null);

  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data ?? []));
  }, []);

  const [form, setForm] = useState({
    cliente_id: "",
    modelo_id: "",
    titulo: "",
    corpo: "",
    signatario_nome: "",
    signatario_email: "",
    signatario_documento: "",
    observacoes: "",
    variaveis: {} as Vars,
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
        variaveis: ((q.data as { variaveis?: Vars }).variaveis ?? {}) as Vars,
      });
    }
  }, [q.data]);

  const readonly = q.data?.status === "assinado" || q.data?.status === "cancelado";

  const save = useMutation({
    mutationFn: () => up({ data: {
      id, ...form,
      cliente_id: form.cliente_id || null,
      modelo_id: form.modelo_id || null,
    } }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["contrato", id] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const send = useMutation({
    mutationFn: () => enviar({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato enviado para assinatura");
      qc.invalidateQueries({ queryKey: ["contrato", id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const cancel = useMutation({
    mutationFn: () => cancelar({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato cancelado");
      qc.invalidateQueries({ queryKey: ["contrato", id] });
    },
  });

  // Aplica modelo: substitui corpo + mescla variáveis padrão
  const aplicarModelo = (mid: string) => {
    const m = modelos.data?.find((x) => x.id === mid);
    if (!m) return;
    const defaultVars = ((m as { variaveis?: Vars }).variaveis ?? {}) as Vars;
    setForm((f) => ({
      ...f,
      modelo_id: mid,
      corpo: m.corpo ?? "",
      titulo: f.titulo || m.nome,
      variaveis: { ...defaultVars, ...f.variaveis },
    }));
    toast.success(`Modelo "${m.nome}" aplicado`);
  };

  // Pré-preencher dados do cliente
  const preencherDadosCliente = async () => {
    if (!form.cliente_id) return toast.error("Selecione um cliente primeiro");
    const [{ data: cli }, { data: dc }] = await Promise.all([
      supabase.from("clientes").select("nome, operacional").eq("id", form.cliente_id).maybeSingle(),
      supabase.from("dados_corporativos").select("*").eq("cliente_id", form.cliente_id).maybeSingle(),
    ]);
    const op = (cli?.operacional ?? {}) as Record<string, string | undefined>;
    const patch: Vars = {
      cliente_razao_social: dc?.razao_social ?? cli?.nome ?? "",
      cliente_nome_completo: dc?.representante_nome ?? op.responsavel ?? "",
      cliente_cpf: dc?.representante_cpf ?? "",
      cliente_email: dc?.email_comercial ?? op.email ?? "",
      cliente_cnpj: dc?.cnpj ?? "",
      cliente_endereco: [dc?.endereco, dc?.bairro, dc?.cidade_uf, dc?.cep].filter(Boolean).join(", "),
      cliente_whatsapp: dc?.telefone ?? op.whatsapp ?? "",
    };
    setForm((f) => ({
      ...f,
      variaveis: { ...f.variaveis, ...patch },
      signatario_nome: f.signatario_nome || patch.cliente_nome_completo,
      signatario_email: f.signatario_email || patch.cliente_email,
      signatario_documento: f.signatario_documento || patch.cliente_cpf || patch.cliente_cnpj,
    }));
    toast.success("Dados do cliente aplicados");
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = q.data?.token_publico ? `${baseUrl}/contrato/assinar/${q.data.token_publico}` : null;
  const viewLink = q.data?.token_publico ? `${baseUrl}/contrato/ver/${q.data.token_publico}` : null;
  const adminAssinado = !!q.data?.assinado_admin_em;

  const doAdminSign = useMutation({
    mutationFn: async () => {
      if (!adminNome.trim()) throw new Error("Informe seu nome completo");
      const img = sigRef.current && !sigRef.current.isEmpty() ? sigRef.current.toDataURL("image/png") : null;
      if (!img) throw new Error("Desenhe sua assinatura");
      return adminSign({ data: { id, nome_completo: adminNome.trim(), documento: adminDoc || null, assinatura_imagem: img, assinatura_texto: adminNome.trim() } });
    },
    onSuccess: () => {
      toast.success("Contrato assinado pela CONTRATADA");
      setAdminOpen(false);
      qc.invalidateQueries({ queryKey: ["contrato", id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const preview = useMemo(
    () => renderVars(form.corpo, form.variaveis, { data_assinatura: new Date().toLocaleDateString("pt-BR") }),
    [form.corpo, form.variaveis],
  );

  const whatsappLink = useMemo(() => {
    if (!link) return null;
    const raw = (form.variaveis.cliente_whatsapp ?? "").replace(/\D/g, "");
    if (!raw) return null;
    const phone = raw.startsWith("55") ? raw : `55${raw}`;
    const txt = encodeURIComponent(`Olá! Segue o link do seu contrato ${form.titulo}: ${link}`);
    return `https://wa.me/${phone}?text=${txt}`;
  }, [link, form.titulo, form.variaveis]);

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
        <div className="flex flex-wrap gap-2">
          {viewLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={viewLink} target="_blank" rel="noopener"><Eye className="mr-1 h-4 w-4" />Ver contrato</a>
            </Button>
          )}
          {q.data && q.data.status !== "cancelado" && !adminAssinado && (
            <Button variant="secondary" size="sm" onClick={() => setAdminOpen(true)}>
              <PenLine className="mr-1 h-4 w-4" />Assinar como CONTRATADA
            </Button>
          )}
          {adminAssinado && (
            <Badge className="bg-emerald-100 text-emerald-800">CONTRATADA assinou</Badge>
          )}
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
        <Card className="flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/30">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-medium">Link público de assinatura (cliente)</div>
            <code className="text-xs text-muted-foreground break-all">{link}</code>
            {viewLink && (
              <div className="mt-1"><span className="text-xs font-medium">Link para visualização: </span><code className="text-xs text-muted-foreground break-all">{viewLink}</code></div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <Copy className="mr-1 h-3 w-3" />Copiar assinar
          </Button>
          {viewLink && (
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(viewLink); toast.success("Link copiado"); }}>
              <Copy className="mr-1 h-3 w-3" />Copiar ver
            </Button>
          )}
          {whatsappLink && (
            <Button size="sm" variant="outline" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener"><MessageCircle className="mr-1 h-3 w-3" />WhatsApp</a>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={link} target="_blank" rel="noopener">Abrir</a>
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Cabeçalho */}
          <Card className="space-y-4 p-4">
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
            {form.cliente_id && !readonly && (
              <Button size="sm" variant="secondary" onClick={preencherDadosCliente}>
                <Wand2 className="mr-2 h-4 w-4" />Preencher dados do cliente automaticamente
              </Button>
            )}
          </Card>

          {/* Dados do CONTRATANTE (variáveis) */}
          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold">Dados do CONTRATANTE</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {CLIENTE_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={form.variaveis[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, variaveis: { ...s.variaveis, [f.key]: e.target.value } }))}
                    disabled={readonly}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Quadro Resumo */}
          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold">Quadro Resumo</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {QR_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={form.variaveis[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, variaveis: { ...s.variaveis, [f.key]: e.target.value } }))}
                    disabled={readonly}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Signatário */}
          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold">Signatário (quem vai assinar)</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Nome</Label>
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
          </Card>

          {/* Corpo do contrato */}
          <Card className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Corpo do contrato (cláusulas editáveis)</div>
              <span className="text-xs text-muted-foreground">Use <code>{"{{variavel}}"}</code> para valores dinâmicos</span>
            </div>
            <Textarea
              value={form.corpo}
              onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
              rows={22}
              className="font-mono text-xs"
              disabled={readonly}
              placeholder="Aplique um modelo para começar."
            />
          </Card>

          <Card className="p-4">
            <Label>Observações internas</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} disabled={readonly} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Pré-visualização (com variáveis)</div>
            <div className="max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs leading-relaxed">
              {preview || "(vazio)"}
            </div>
          </Card>

          {q.data?.assinaturas && q.data.assinaturas.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold">Evidências de assinatura</div>
              {q.data.assinaturas.map((a: {
                id: string; nome_completo: string; documento?: string | null; email?: string | null;
                ip?: string | null; created_at: string; documento_hash?: string | null;
                assinatura_imagem?: string | null; assinatura_texto?: string | null;
              }) => (
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
