import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { upsertClienteManual, type ClienteInput } from "@/lib/cliente.functions";
import { listModelos, upsertContrato } from "@/lib/contratos.functions";
import { supabase } from "@/integrations/supabase/client";

export const ESTAGIOS = [
  "Venda Concluída",
  "Contrato Assinado",
  "Financeiro",
  "Formulário de Cliente",
  "Onboarding",
  "Planejamento",
  "1° REUNIÃO CS",
  "Cliente",
  "UPSELL",
  "Aviso de Churn",
  "Pausado",
  "Churn",
  "Projeto Finalizado (Não Churn)",
];

export const PLANOS = ["MK6 Jorney", "Aceleração PRO", "Aceleração", "Performance", "Personalizado"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: Partial<ClienteInput> & { id?: string | null };
  onSaved?: (id: string) => void;
};

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

export function ClienteEditDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const upsert = useServerFn(upsertClienteManual);
  const lModelos = useServerFn(listModelos);
  const createContrato = useServerFn(upsertContrato);

  const modelos = useQuery({ queryKey: ["contrato-modelos"], queryFn: () => lModelos(), enabled: open });

  const [form, setForm] = useState<ClienteInput>({
    id: cliente?.id ?? null,
    nome: cliente?.nome ?? "",
    estagio: cliente?.estagio ?? null,
    plano: cliente?.plano ?? null,
    inicio_contrato: cliente?.inicio_contrato ?? null,
    fim_contrato: cliente?.fim_contrato ?? null,
    valor_mensal: cliente?.valor_mensal ?? null,
    orcamento_ads: cliente?.orcamento_ads ?? null,
    satisfacao: null,
    observacao: cliente?.observacao ?? null,
    ultima_reuniao_gestor: cliente?.ultima_reuniao_gestor ?? null,
    ultima_otimizacao: cliente?.ultima_otimizacao ?? null,
    feedback_data: cliente?.feedback_data ?? null,
    data_reuniao_cs: cliente?.data_reuniao_cs ?? null,
  });

  const [selModelo, setSelModelo] = useState<string>("");
  const [qr, setQr] = useState<Record<string, string>>(emptyQR);

  useEffect(() => {
    if (open) {
      setForm({
        id: cliente?.id ?? null,
        nome: cliente?.nome ?? "",
        estagio: cliente?.estagio ?? null,
        plano: cliente?.plano ?? null,
        inicio_contrato: cliente?.inicio_contrato ?? null,
        fim_contrato: cliente?.fim_contrato ?? null,
        valor_mensal: cliente?.valor_mensal ?? null,
        orcamento_ads: cliente?.orcamento_ads ?? null,
        satisfacao: null,
        observacao: cliente?.observacao ?? null,
        ultima_reuniao_gestor: cliente?.ultima_reuniao_gestor ?? null,
        ultima_otimizacao: cliente?.ultima_otimizacao ?? null,
        feedback_data: cliente?.feedback_data ?? null,
        data_reuniao_cs: cliente?.data_reuniao_cs ?? null,
      });
      setSelModelo("");
      setQr(emptyQR);
    }
  }, [open, cliente]);

  // Pré-preenche "Serviço Incluso" com o nome do modelo
  useEffect(() => {
    const m = modelos.data?.find((x) => x.id === selModelo);
    if (m && !qr.qr_servico_incluso) setQr((s) => ({ ...s, qr_servico_incluso: m.nome }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selModelo]);

  const mut = useMutation({
    mutationFn: async () => {
      const res = await upsert({ data: form });

      // Se há modelo selecionado, cria o contrato vinculado
      if (selModelo) {
        const modelo = modelos.data?.find((m) => m.id === selModelo);
        if (modelo) {
          const { data: dc } = await supabase
            .from("dados_corporativos")
            .select("*")
            .eq("cliente_id", res.id)
            .maybeSingle();
          const defaultVars = (modelo as { variaveis?: Record<string, string> }).variaveis ?? {};
          const variaveis = {
            ...defaultVars,
            cliente_razao_social: dc?.razao_social ?? form.nome ?? "",
            cliente_nome_completo: dc?.representante_nome ?? "",
            cliente_cpf: dc?.representante_cpf ?? "",
            cliente_email: dc?.email_comercial ?? "",
            cliente_cnpj: dc?.cnpj ?? "",
            cliente_endereco: [dc?.endereco, dc?.bairro, dc?.cidade_uf, dc?.cep].filter(Boolean).join(", "),
            cliente_whatsapp: dc?.telefone ?? "",
            ...qr,
          };
          const contrato = await createContrato({
            data: {
              cliente_id: res.id,
              modelo_id: selModelo,
              titulo: `${modelo.nome} — ${form.nome}`,
              corpo: modelo.corpo ?? "",
              signatario_nome: variaveis.cliente_nome_completo || "",
              signatario_email: variaveis.cliente_email || "",
              signatario_documento: variaveis.cliente_cpf || variaveis.cliente_cnpj || "",
              variaveis,
            },
          });
          return { ...res, contratoId: contrato.id as string };
        }
      }
      return res;
    },
    onSuccess: (r: { id: string; novo: boolean; contratoId?: string }) => {
      toast.success(r.novo ? "Cliente criado!" : "Cliente atualizado!");
      qc.invalidateQueries({ queryKey: ["clientes-base"] });
      qc.invalidateQueries({ queryKey: ["cliente", r.id] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      onSaved?.(r.id);
      onOpenChange(false);
      if (r.contratoId) {
        toast.success("Contrato criado — revise e envie");
        navigate({ to: "/contratos/$id", params: { id: r.contratoId } });
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const set = <K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) =>
    setForm((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>
            Dados gerais do cliente. Contratos, dados corporativos e equipe são editados nas abas específicas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Fld label="Nome *" className="md:col-span-2">
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do cliente" />
          </Fld>

          <Fld label="Estágio">
            <Select value={form.estagio ?? ""} onValueChange={(v) => set("estagio", v || null)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ESTAGIOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Fld>

          <Fld label="Plano (editável)">
            <Input
              list="planos-sugestoes"
              value={form.plano ?? ""}
              onChange={(e) => set("plano", e.target.value || null)}
              placeholder="MK6 Jorney"
            />
            <datalist id="planos-sugestoes">
              {PLANOS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </Fld>

          <Fld label="Início do Contrato">
            <Input type="date" value={form.inicio_contrato ?? ""} onChange={(e) => set("inicio_contrato", e.target.value || null)} />
          </Fld>
          <Fld label="Fim do Contrato">
            <Input type="date" value={form.fim_contrato ?? ""} onChange={(e) => set("fim_contrato", e.target.value || null)} />
          </Fld>

          <Fld label="Valor Mensal (R$)">
            <Input type="number" step="0.01" value={form.valor_mensal ?? ""} onChange={(e) => set("valor_mensal", num(e.target.value))} />
          </Fld>
          <Fld label="Orçamento de Anúncios (R$)">
            <Input type="number" step="0.01" value={form.orcamento_ads ?? ""} onChange={(e) => set("orcamento_ads", num(e.target.value))} />
          </Fld>

          <Fld label="Última Reunião Gestor">
            <Input type="date" value={form.ultima_reuniao_gestor ?? ""} onChange={(e) => set("ultima_reuniao_gestor", e.target.value || null)} />
          </Fld>
          <Fld label="Última Otimização">
            <Input type="date" value={form.ultima_otimizacao ?? ""} onChange={(e) => set("ultima_otimizacao", e.target.value || null)} />
          </Fld>
          <Fld label="Data Feedback">
            <Input type="date" value={form.feedback_data ?? ""} onChange={(e) => set("feedback_data", e.target.value || null)} />
          </Fld>
          <Fld label="Reunião CS">
            <Input type="date" value={form.data_reuniao_cs ?? ""} onChange={(e) => set("data_reuniao_cs", e.target.value || null)} />
          </Fld>

          <Fld label="Observação" className="md:col-span-2">
            <Textarea rows={3} value={form.observacao ?? ""} onChange={(e) => set("observacao", e.target.value || null)} />
          </Fld>
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="mb-2 text-sm font-semibold">Contrato (opcional)</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Selecione um modelo para já gerar o contrato do cliente. Deixe em branco para pular esta etapa.
          </p>
          <div className="mb-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Modelo de contrato</Label>
            <Select value={selModelo} onValueChange={setSelModelo}>
              <SelectTrigger><SelectValue placeholder="Nenhum (não gerar contrato)" /></SelectTrigger>
              <SelectContent>
                {modelos.data?.filter((m) => m.ativo).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selModelo && (
            <div>
              <div className="mb-2 text-sm font-semibold">Quadro Resumo</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { k: "qr_servico_incluso", l: "(i) Serviço Incluso" },
                  { k: "qr_preco_total", l: "(ii) Preço Total", ph: "R$ 12.500,00" },
                  { k: "qr_forma_pagamento", l: "(iii) Forma de Pagamento", ph: "À vista / Parcelado 3x…" },
                  { k: "qr_metodo_pagamento", l: "(iv) Método de Pagamento", ph: "PIX / Cartão / Boleto" },
                  { k: "qr_primeiro_vencimento", l: "(v) Primeiro Vencimento", ph: "DD/MM/AAAA" },
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
                <div className="md:col-span-2">
                  <Label className="text-xs">(vi) Obs. Pagamento</Label>
                  <Textarea
                    rows={2}
                    value={qr.qr_obs_pagamento ?? ""}
                    onChange={(e) => setQr((s) => ({ ...s, qr_obs_pagamento: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nome.trim()}>
            {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {selModelo ? "Salvar e gerar contrato" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fld({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
