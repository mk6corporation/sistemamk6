import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Building2, FileText, Users, Save, Plus, Trash2, Star, CalendarDays, MessageSquare, Search, Smile, Briefcase, Pencil } from "lucide-react";
import { toast } from "sonner";
import { TimelineTab } from "@/components/cliente/timeline-tab";
import { CheckinsTab } from "@/components/cliente/checkins-tab";
import { SatisfacaoTab } from "@/components/cliente/satisfacao-tab";
import { VendedoresClienteTab } from "@/components/cliente/vendedores-cliente-tab";
import { ClienteEditDialog } from "@/components/cliente/cliente-edit-dialog";

import { consultarCnpj } from "@/lib/cnpj.functions";
import { deleteClienteManual } from "@/lib/cliente.functions";

export const Route = createFileRoute("/_authenticated/clientes/$clienteId")({
  component: ClienteDetailPage,
});

const STATUS_CRM = ["Lead", "Em Negociação", "Proposta Enviada", "Venda Fechada", "Perdido"];
const TIPO_CONTRATO = [
  { value: "base", label: "Contrato Base" },
  { value: "upsell", label: "Upsell" },
  { value: "renovacao", label: "Renovação" },
];
const STATUS_RECEBIMENTO = ["Pendente", "Parcial", "Valor Recebido!", "Atrasado", "Cancelado"];

function formatMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcVigencia(inicio: string | null, fim: string | null): string {
  if (!inicio || !fim) return "—";
  const d1 = new Date(inicio), d2 = new Date(fim);
  const meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (meses < 1) return "menos de 1 mês";
  if (meses === 1) return "1 mês";
  if (meses < 12) return `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const r = meses % 12;
  return r === 0 ? `${anos} ano${anos > 1 ? "s" : ""}` : `${anos}a ${r}m`;
}

function ClienteDetailPage() {
  const { clienteId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const clienteQuery = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (clienteQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!clienteQuery.data) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button variant="link" onClick={() => navigate({ to: "/" })}>Voltar</Button>
      </div>
    );
  }

  const cliente = clienteQuery.data;
  const [editOpen, setEditOpen] = useState(false);
  const delFn = useServerFn(deleteClienteManual);
  const del = useMutation({
    mutationFn: async () => delFn({ data: { id: clienteId } }),
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clientes-base"] });
      navigate({ to: "/clientes" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{cliente.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {cliente.estagio && <Badge variant="outline">{cliente.estagio}</Badge>}
            {cliente.categoria && <Badge variant="secondary">{cliente.categoria}</Badge>}
            {cliente.plano && <span>· {cliente.plano}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm(`Excluir cliente "${cliente.nome}"? Esta ação não pode ser desfeita.`)) del.mutate(); }}
            disabled={del.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      <ClienteEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cliente={cliente as any}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cliente", clienteId] })}
      />

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dados"><Building2 className="mr-2 h-4 w-4" />Dados Corporativos</TabsTrigger>
          <TabsTrigger value="contratos"><FileText className="mr-2 h-4 w-4" />Contratos</TabsTrigger>
          <TabsTrigger value="equipe"><Users className="mr-2 h-4 w-4" />Equipe</TabsTrigger>
          <TabsTrigger value="timeline"><CalendarDays className="mr-2 h-4 w-4" />Linha do Tempo</TabsTrigger>
          <TabsTrigger value="checkins"><MessageSquare className="mr-2 h-4 w-4" />Check-ins</TabsTrigger>
          <TabsTrigger value="satisfacao"><Smile className="mr-2 h-4 w-4" />Desempenho</TabsTrigger>
          <TabsTrigger value="vendedores"><Briefcase className="mr-2 h-4 w-4" />Vendedores</TabsTrigger>
        </TabsList>

        <TabsContent value="dados"><DadosCorporativosTab clienteId={clienteId} /></TabsContent>
        <TabsContent value="contratos"><ContratosTab clienteId={clienteId} /></TabsContent>
        <TabsContent value="equipe"><EquipeComercialTab clienteId={clienteId} /></TabsContent>
        <TabsContent value="timeline"><TimelineTab clienteId={clienteId} /></TabsContent>
        <TabsContent value="checkins"><CheckinsTab clienteId={clienteId} /></TabsContent>
        <TabsContent value="satisfacao"><SatisfacaoTab clienteId={clienteId} /></TabsContent>
        <TabsContent value="vendedores"><VendedoresClienteTab clienteId={clienteId} clienteNome={cliente.nome} /></TabsContent>

      </Tabs>
    </div>
  );
}

// ============ DADOS CORPORATIVOS ============
function DadosCorporativosTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["dados_corporativos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dados_corporativos").select("*").eq("cliente_id", clienteId).maybeSingle();
      if (error) throw error;
      // auto-cria registro vazio
      if (!data) {
        const { data: created, error: err2 } = await supabase
          .from("dados_corporativos").insert({ cliente_id: clienteId }).select().single();
        if (err2) throw err2;
        return created;
      }
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dados_corporativos").update({
        nome_fantasia: form.nome_fantasia, razao_social: form.razao_social, cnpj: form.cnpj,
        endereco: form.endereco, bairro: form.bairro, cidade_uf: form.cidade_uf, cep: form.cep,
        representante_nome: form.representante_nome, representante_cpf: form.representante_cpf,
        status_crm: form.status_crm, telefone: form.telefone, email_comercial: form.email_comercial,
      }).eq("cliente_id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados corporativos salvos!"); qc.invalidateQueries({ queryKey: ["dados_corporativos", clienteId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const consultar = useServerFn(consultarCnpj);
  const lookup = useMutation({
    mutationFn: async () => {
      const cnpj = (form.cnpj ?? "").toString();
      return consultar({ data: { cnpj, clienteId: clienteId } });
    },
    onSuccess: (r: any) => {
      if (!r?.ok) {
        toast.error(r?.error ?? "Não foi possível consultar o CNPJ");
        return;
      }
      const n = r.filled?.length ?? 0;
      toast.success(n > 0 ? `BrasilAPI: ${n} campo(s) preenchido(s)` : "Nada a preencher (campos já estão completos)");
      qc.invalidateQueries({ queryKey: ["dados_corporativos", clienteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (query.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const onField = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-primary" />Dados Corporativos</CardTitle>
        <div className="flex gap-2">
          <Button onClick={() => lookup.mutate()} disabled={lookup.isPending || !form.cnpj} size="sm" variant="outline">
            {lookup.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />} Consultar CNPJ
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Nome Fantasia"><Input value={form.nome_fantasia ?? ""} onChange={onField("nome_fantasia")} /></Field>
          <Field label="Razão Social"><Input value={form.razao_social ?? ""} onChange={onField("razao_social")} /></Field>
          <Field label="CNPJ"><Input value={form.cnpj ?? ""} onChange={onField("cnpj")} placeholder="00.000.000/0000-00" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <Field label="Endereço Completo"><Input value={form.endereco ?? ""} onChange={onField("endereco")} /></Field>
          <Field label="Bairro"><Input value={form.bairro ?? ""} onChange={onField("bairro")} /></Field>
          <Field label="Cidade / UF"><Input value={form.cidade_uf ?? ""} onChange={onField("cidade_uf")} /></Field>
          <Field label="CEP"><Input value={form.cep ?? ""} onChange={onField("cep")} placeholder="00000-000" /></Field>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Representante Legal & Contato</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Nome Completo"><Input value={form.representante_nome ?? ""} onChange={onField("representante_nome")} /></Field>
            <Field label="CPF Representante"><Input value={form.representante_cpf ?? ""} onChange={onField("representante_cpf")} placeholder="000.000.000-00" /></Field>
            <Field label="Status do CRM">
              <Select value={form.status_crm ?? ""} onValueChange={(v) => setForm({ ...form, status_crm: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{STATUS_CRM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Telefone / WhatsApp"><Input value={form.telefone ?? ""} onChange={onField("telefone")} /></Field>
            <Field label="E-mail Comercial" className="md:col-span-2"><Input type="email" value={form.email_comercial ?? ""} onChange={onField("email_comercial")} /></Field>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ============ CONTRATOS ============
function ContratosTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["contratos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*")
        .eq("cliente_id", clienteId).order("inicio_contrato", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (tipo: "base" | "upsell" | "renovacao") => {
      const { data, error } = await supabase.from("contratos")
        .insert({ cliente_id: clienteId, tipo, status_recebimento: "Pendente" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contratos", clienteId] });
      qc.invalidateQueries({ queryKey: ["renovacoes-contratos"] });
      qc.invalidateQueries({ queryKey: ["renovacao-clientes"] });
      setEditingId(data.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contratos", clienteId] });
      qc.invalidateQueries({ queryKey: ["renovacoes-contratos"] });
      qc.invalidateQueries({ queryKey: ["renovacao-clientes"] });
      toast.success("Contrato removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (query.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const contratos = query.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Contratos ({contratos.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => create.mutate("base")}><Plus className="mr-1 h-4 w-4" />Contrato Base</Button>
            <Button size="sm" variant="outline" onClick={() => create.mutate("upsell")}><Plus className="mr-1 h-4 w-4" />Upsell</Button>
            <Button size="sm" variant="outline" onClick={() => create.mutate("renovacao")}><Plus className="mr-1 h-4 w-4" />Renovação</Button>
          </div>
        </CardHeader>
        <CardContent>
          {contratos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum contrato. Crie o primeiro acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setEditingId(editingId === c.id ? null : c.id)}>
                    <TableCell>
                      <Badge variant={c.tipo === "base" ? "default" : c.tipo === "upsell" ? "secondary" : "outline"}>
                        {c.tipo === "base" && <Star className="mr-1 h-3 w-3" />}
                        {c.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.produto_contratado ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.inicio_contrato ?? "—"} → {c.fim_contrato ?? "—"}
                      <div className="text-xs text-primary">{calcVigencia(c.inicio_contrato, c.fim_contrato)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.fee_mensal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.valor_total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.valor_recebido)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.status_recebimento ?? "—"}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover contrato?")) remove.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingId && <ContratoEditor key={editingId} contratoId={editingId} clienteId={clienteId} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function ContratoEditor({ contratoId, clienteId, onClose }: { contratoId: string; clienteId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["contrato", contratoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*").eq("id", contratoId).single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        tipo: form.tipo, produto_contratado: form.produto_contratado, tipo_projeto: form.tipo_projeto,
        banco_recebimento: form.banco_recebimento, inicio_contrato: form.inicio_contrato || null,
        fim_contrato: form.fim_contrato || null, forma_pagamento: form.forma_pagamento,
        dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
        fee_mensal: (() => {
          const vt = Number(form.valor_total) || 0;
          if (!form.inicio_contrato || !form.fim_contrato || vt <= 0) return null;
          const meses = Math.max(1, Math.round((new Date(form.fim_contrato).getTime() - new Date(form.inicio_contrato).getTime()) / (1000 * 60 * 60 * 24 * 30)));
          return Number((vt / meses).toFixed(2));
        })(),
        valor_total: form.valor_total ? Number(form.valor_total) : null,
        valor_recebido: form.valor_recebido ? Number(form.valor_recebido) : 0,
        status_recebimento: form.status_recebimento, observacoes: form.observacoes,
      };
      const { error } = await supabase.from("contratos").update(payload).eq("id", contratoId);
      if (error) throw error;

      // Sincroniza clientes.fim_contrato / inicio_contrato com o contrato mais recente
      const { data: all } = await supabase
        .from("contratos")
        .select("inicio_contrato,fim_contrato")
        .eq("cliente_id", clienteId);
      const fins = (all ?? [])
        .map((c: any) => c.fim_contrato)
        .filter(Boolean)
        .sort();
      const inicios = (all ?? [])
        .map((c: any) => c.inicio_contrato)
        .filter(Boolean)
        .sort();
      const maiorFim = fins.length ? fins[fins.length - 1] : null;
      const menorInicio = inicios.length ? inicios[0] : null;
      await supabase
        .from("clientes")
        .update({ fim_contrato: maiorFim, inicio_contrato: menorInicio })
        .eq("id", clienteId);
    },
    onSuccess: () => {
      toast.success("Contrato salvo!");
      qc.invalidateQueries({ queryKey: ["contratos", clienteId] });
      qc.invalidateQueries({ queryKey: ["contrato", contratoId] });
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["renovacao-clientes"] });
      qc.invalidateQueries({ queryKey: ["renovacoes-contratos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (query.isLoading) return <Card><CardContent className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const valorTotalNum = Number(form.valor_total) || 0;
  const valorRecebidoNum = Number(form.valor_recebido) || 0;
  const saldo = valorTotalNum - valorRecebidoNum;
  // Fee mensal automático = valor total / meses do contrato
  let mesesContrato = 0;
  if (form.inicio_contrato && form.fim_contrato) {
    const d1 = new Date(form.inicio_contrato);
    const d2 = new Date(form.fim_contrato);
    mesesContrato = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }
  const feeMensalAuto = mesesContrato > 0 && valorTotalNum > 0 ? valorTotalNum / mesesContrato : null;
  const pctRecebido = valorTotalNum > 0 ? Math.min(100, Math.round((valorRecebidoNum / valorTotalNum) * 100)) : 0;

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-primary" />
          Serviço {form.tipo === "base" ? "Principal (Contrato Base)" : form.tipo === "upsell" ? "Upsell" : "Renovação"}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Tipo do Contrato">
            <Select value={form.tipo ?? ""} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPO_CONTRATO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Produto Contratado"><Input value={form.produto_contratado ?? ""} onChange={f("produto_contratado")} placeholder="Ex: Método Joney" /></Field>
          <Field label="Tipo de Projeto"><Input value={form.tipo_projeto ?? ""} onChange={f("tipo_projeto")} placeholder="Ex: Fee mensal" /></Field>
          <Field label="Banco (Recebimento)"><Input value={form.banco_recebimento ?? ""} onChange={f("banco_recebimento")} /></Field>
          <Field label="Forma Pagamento"><Input value={form.forma_pagamento ?? ""} onChange={f("forma_pagamento")} placeholder="PIX, Boleto..." /></Field>
          <Field label="Dia de Vencimento"><Input type="number" min="1" max="31" value={form.dia_vencimento ?? ""} onChange={f("dia_vencimento")} /></Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Início Contrato"><Input type="date" value={form.inicio_contrato ?? ""} onChange={f("inicio_contrato")} /></Field>
          <Field label="Fim Contrato"><Input type="date" value={form.fim_contrato ?? ""} onChange={f("fim_contrato")} /></Field>
          <Field label="Vigência (automática)">
            <div className="flex h-9 items-center rounded-md border border-input bg-primary/5 px-3 text-sm font-medium text-primary">
              {calcVigencia(form.inicio_contrato, form.fim_contrato)}
            </div>
          </Field>
        </div>

        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-muted/40 to-muted/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financeiro do Serviço</span>
            {valorTotalNum > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {pctRecebido}% recebido
              </span>
            )}
          </div>
          {valorTotalNum > 0 && (
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                style={{ width: `${pctRecebido}%` }}
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Fee Mensal (automático)">
              <div className="flex h-9 items-center justify-between rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-semibold tabular-nums text-blue-700">
                <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600/70">R$</span>
                <span>{feeMensalAuto != null ? feeMensalAuto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</span>
              </div>
            </Field>
            <Field label="Valor Total (este serviço)">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_total ?? ""}
                  onChange={f("valor_total")}
                  className="pl-9 font-semibold tabular-nums"
                />
              </div>
              {valorTotalNum > 0 && (
                <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">
                  {formatMoney(valorTotalNum)}
                </span>
              )}
            </Field>
            <Field label="Valor Recebido">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_recebido ?? ""}
                  onChange={f("valor_recebido")}
                  className="border-emerald-500/30 bg-emerald-500/5 pl-9 font-semibold tabular-nums text-emerald-700 focus-visible:ring-emerald-500/30"
                />
              </div>
              {valorRecebidoNum > 0 && (
                <span className="mt-1 block text-[11px] font-medium text-emerald-700 tabular-nums">
                  {formatMoney(valorRecebidoNum)}
                </span>
              )}
            </Field>
            <Field label="Saldo Restante (automático)">
              <div className={`flex h-9 items-center rounded-md border px-3 text-sm font-semibold tabular-nums ${saldo > 0 ? "border-red-500/30 bg-red-500/10 text-red-700" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"}`}>
                {formatMoney(saldo)}
              </div>
            </Field>
          </div>
        </div>

        <Field label="Status de Recebimento">
          <Select value={form.status_recebimento ?? ""} onValueChange={(v) => setForm({ ...form, status_recebimento: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>{STATUS_RECEBIMENTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>

        <Field label="Observações"><Textarea value={form.observacoes ?? ""} onChange={f("observacoes")} rows={3} /></Field>

        <ComprovantesSection contratoId={contratoId} clienteId={clienteId} />
      </CardContent>
    </Card>
  );
}

function ComprovantesSection({ contratoId, clienteId }: { contratoId: string; clienteId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["comprovantes", contratoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comprovantes").select("*").eq("contrato_id", contratoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      const path = `${clienteId}/${contratoId}/${Date.now()}_${safeName || "arquivo"}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("comprovantes").insert({
        contrato_id: contratoId, cliente_id: clienteId, storage_path: path,
        nome_arquivo: file.name, tamanho: file.size, mime_type: file.type,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comprovantes", contratoId] }); toast.success("Comprovante enviado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (item: any) => {
      await supabase.storage.from("comprovantes").remove([item.storage_path]);
      const { error } = await supabase.from("comprovantes").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comprovantes", contratoId] }); toast.success("Removido"); },
  });

  const download = async (item: any) => {
    const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(item.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="rounded-lg border bg-emerald-500/5 p-4">
      <Label className="text-xs font-semibold uppercase">📎 Comprovantes</Label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.currentTarget.value = ""; }} className="max-w-xs" disabled={upload.isPending} />
      </div>
      <div className="mt-3 space-y-1">
        {(query.data ?? []).map((it: any) => (
          <div key={it.id} className="flex items-center gap-2 rounded border bg-card p-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <button onClick={() => download(it)} className="flex-1 truncate text-left hover:underline">{it.nome_arquivo}</button>
            <Button size="icon" variant="ghost" onClick={() => remove.mutate(it)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {(query.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum comprovante anexado.</p>}
      </div>
    </div>
  );
}

// ============ EQUIPE COMERCIAL ============
function EquipeComercialTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["equipe", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipe_comercial_cliente").select("*").eq("cliente_id", clienteId).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: c, error: e2 } = await supabase.from("equipe_comercial_cliente").insert({ cliente_id: clienteId }).select().single();
        if (e2) throw e2;
        return c;
      }
      return data;
    },
  });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("equipe_comercial_cliente").update({
        vendedor_nome: form.vendedor_nome, pre_vendedor_nome: form.pre_vendedor_nome,
        data_venda: form.data_venda || null, observacoes: form.observacoes,
        gestor_nome: form.gestor_nome, cs_nome: form.cs_nome,
      }).eq("cliente_id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipe salva!");
      qc.invalidateQueries({ queryKey: ["equipe", clienteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (query.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" />Equipe do Cliente</CardTitle>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comercial</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Vendedor"><Input value={form.vendedor_nome ?? ""} onChange={f("vendedor_nome")} placeholder="Nome do vendedor" /></Field>
              <Field label="Pré-Vendedor (SDR)"><Input value={form.pre_vendedor_nome ?? ""} onChange={f("pre_vendedor_nome")} placeholder="Nome do SDR" /></Field>
              <Field label="Data da Venda"><Input type="date" value={form.data_venda ?? ""} onChange={f("data_venda")} /></Field>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operacional</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Gestor"><Input value={form.gestor_nome ?? ""} onChange={f("gestor_nome")} placeholder="Nome do gestor responsável" /></Field>
              <Field label="CS (Sucesso do Cliente)"><Input value={form.cs_nome ?? ""} onChange={f("cs_nome")} placeholder="Nome do CS responsável" /></Field>
            </div>
          </div>

          <Field label="Observações"><Textarea value={form.observacoes ?? ""} onChange={f("observacoes")} rows={3} /></Field>
        </CardContent>
      </Card>
    </div>
  );
}
