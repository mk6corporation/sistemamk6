import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, FileText, Trash2, ExternalLink, Library, UserPlus, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listContratos, upsertContrato, deleteContrato, listModelos } from "@/lib/contratos.functions";
import { ClienteEditDialog } from "@/components/cliente/cliente-edit-dialog";


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
  const lModelos = useServerFn(listModelos);

  const q = useQuery({ queryKey: ["contratos"], queryFn: () => list() });
  const modelos = useQuery({ queryKey: ["contrato-modelos"], queryFn: () => lModelos() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string; plano: string | null }[]>([]);
  const [filtroCli, setFiltroCli] = useState("");
  const [selCliente, setSelCliente] = useState<string>("");
  const [selModelo, setSelModelo] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const emptyQR = {
    qr_servico_incluso: "",
    qr_preco_total: "",
    qr_forma_pagamento: "",
    qr_metodo_pagamento: "",
    qr_primeiro_vencimento: "",
    qr_obs_pagamento: "",
    qr_inicio_servico: "",
    qr_duracao_servico: "",
  };
  const [qr, setQr] = useState<Record<string, string>>(emptyQR);

  useEffect(() => {
    supabase.from("clientes").select("id, nome, plano").order("nome").then(({ data }) => setClientes(data ?? []));
  }, []);

  // Pré-preenche qr_servico_incluso com o nome do modelo ao selecioná-lo
  useEffect(() => {
    const m = modelos.data?.find((x) => x.id === selModelo);
    if (m && !qr.qr_servico_incluso) setQr((s) => ({ ...s, qr_servico_incluso: m.nome }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selModelo]);

  const novoRascunho = useMutation({
    mutationFn: () => create({ data: { titulo: "Novo contrato", corpo: "" } }),
    onSuccess: (r) => navigate({ to: "/contratos/$id", params: { id: r.id } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const criarDeCliente = useMutation({
    mutationFn: async () => {
      if (!selCliente || !selModelo) throw new Error("Selecione cliente e modelo");
      const modelo = modelos.data?.find((m) => m.id === selModelo);
      const cli = clientes.find((c) => c.id === selCliente);
      if (!modelo || !cli) throw new Error("Cliente ou modelo inválido");

      // Buscar dados_corporativos
      const { data: dc } = await supabase.from("dados_corporativos").select("*").eq("cliente_id", selCliente).maybeSingle();
      const { data: cliOp } = await supabase.from("clientes").select("operacional").eq("id", selCliente).maybeSingle();
      const op = (cliOp?.operacional ?? {}) as Record<string, string | undefined>;

      const defaultVars = (modelo as { variaveis?: Record<string, string> }).variaveis ?? {};
      const variaveis = {
        ...defaultVars,
        cliente_razao_social: dc?.razao_social ?? cli.nome ?? "",
        cliente_nome_completo: dc?.representante_nome ?? op.responsavel ?? "",
        cliente_cpf: dc?.representante_cpf ?? "",
        cliente_email: dc?.email_comercial ?? op.email ?? "",
        cliente_cnpj: dc?.cnpj ?? "",
        cliente_endereco: [dc?.endereco, dc?.bairro, dc?.cidade_uf, dc?.cep].filter(Boolean).join(", "),
        cliente_whatsapp: dc?.telefone ?? op.whatsapp ?? "",
        ...qr,
      };

      return create({ data: {
        cliente_id: selCliente,
        modelo_id: selModelo,
        titulo: titulo || `${modelo.nome} — ${cli.nome}`,
        corpo: modelo.corpo ?? "",
        signatario_nome: variaveis.cliente_nome_completo || "",
        signatario_email: variaveis.cliente_email || "",
        signatario_documento: variaveis.cliente_cpf || variaveis.cliente_cnpj || "",
        variaveis,
      } });
    },
    onSuccess: (r) => {
      setDialogOpen(false);
      setQr(emptyQR);
      toast.success("Contrato criado — revise e envie");
      navigate({ to: "/contratos/$id", params: { id: r.id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remover = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
  });

  const clientesFiltrados = clientes.filter((c) => c.nome.toLowerCase().includes(filtroCli.toLowerCase())).slice(0, 200);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">Gere, envie e acompanhe assinaturas eletrônicas.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/contratos/modelos"><Library className="mr-2 h-4 w-4" />Modelos</Link>
          </Button>
          <Button variant="outline" onClick={() => novoRascunho.mutate()} disabled={novoRascunho.isPending}>
            <Plus className="mr-2 h-4 w-4" />Rascunho em branco
          </Button>
          <Button onClick={() => { setSelCliente(""); setSelModelo(""); setTitulo(""); setQr(emptyQR); setDialogOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />Novo a partir de cliente
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
              <tr><td className="p-4 text-muted-foreground" colSpan={6}>Nenhum contrato ainda.</td></tr>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo contrato a partir de cliente da base</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modelo *</Label>
              <Select value={selModelo} onValueChange={setSelModelo}>
                <SelectTrigger><SelectValue placeholder="Escolher modelo..." /></SelectTrigger>
                <SelectContent>
                  {modelos.data?.filter((m) => m.ativo).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buscar cliente</Label>
              <Input value={filtroCli} onChange={(e) => setFiltroCli(e.target.value)} placeholder="Digite parte do nome…" />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Select value={selCliente} onValueChange={setSelCliente}>
                <SelectTrigger><SelectValue placeholder={`${clientesFiltrados.length} cliente(s)`} /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {clientesFiltrados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.plano && <span className="ml-1 text-xs text-muted-foreground">· {c.plano}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título (opcional)</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Auto: [modelo] — [cliente]" />
            </div>

            <div className="pt-2 border-t">
              <div className="text-sm font-semibold mb-2">Quadro Resumo</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { k: "qr_servico_incluso", l: "(i) Serviço Incluso" },
                  { k: "qr_preco_total", l: "(ii) Preço Total", ph: "R$ 12.500,00" },
                  { k: "qr_forma_pagamento", l: "(iii) Forma de Pagamento", ph: "À vista / Parcelado 3x…" },
                  { k: "qr_metodo_pagamento", l: "(iv) Método de Pagamento", ph: "PIX / Cartão / Boleto" },
                  { k: "qr_primeiro_vencimento", l: "(v) Primeiro Vencimento", ph: "DD/MM/AAAA" },
                  { k: "qr_obs_pagamento", l: "(vi) Obs. Pagamento" },
                  { k: "qr_inicio_servico", l: "(vii) Início do Serviço", ph: "DD/MM/AAAA" },
                  { k: "qr_duracao_servico", l: "(viii) Duração do Serviço", ph: "3 (três) meses" },
                ].map((f) => (
                  <div key={f.k}>
                    <Label className="text-xs">{f.l}</Label>
                    <Input
                      value={qr[f.k] ?? ""}
                      placeholder={f.ph}
                      onChange={(e) => setQr((s) => ({ ...s, [f.k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Os dados do cliente (razão social, CNPJ, endereço, WhatsApp, e-mail) serão pré-preenchidos automaticamente a partir dos Dados Corporativos.
              Você poderá editar tudo na próxima tela antes de enviar para assinatura.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => criarDeCliente.mutate()} disabled={criarDeCliente.isPending || !selCliente || !selModelo}>
              Criar e abrir
            </Button>
          </DialogFooter>
        </DialogContent>

      </Dialog>
    </div>
  );
}
