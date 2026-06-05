import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

export const ESTAGIOS = [
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

export const PLANOS = ["Aceleração PRO", "Aceleração", "Performance", "Personalizado"];
export const SATISFACOES = ["Muito Satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito Insatisfeito"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: Partial<ClienteInput> & { id?: string | null };
  onSaved?: (id: string) => void;
};

export function ClienteEditDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertClienteManual);
  const [form, setForm] = useState<ClienteInput>({
    id: cliente?.id ?? null,
    nome: cliente?.nome ?? "",
    estagio: cliente?.estagio ?? null,
    plano: cliente?.plano ?? null,
    inicio_contrato: cliente?.inicio_contrato ?? null,
    fim_contrato: cliente?.fim_contrato ?? null,
    valor_mensal: cliente?.valor_mensal ?? null,
    orcamento_ads: cliente?.orcamento_ads ?? null,
    satisfacao: cliente?.satisfacao ?? null,
    observacao: cliente?.observacao ?? null,
    ultima_reuniao_gestor: cliente?.ultima_reuniao_gestor ?? null,
    ultima_otimizacao: cliente?.ultima_otimizacao ?? null,
    feedback_data: cliente?.feedback_data ?? null,
    data_reuniao_cs: cliente?.data_reuniao_cs ?? null,
  });

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
        satisfacao: cliente?.satisfacao ?? null,
        observacao: cliente?.observacao ?? null,
        ultima_reuniao_gestor: cliente?.ultima_reuniao_gestor ?? null,
        ultima_otimizacao: cliente?.ultima_otimizacao ?? null,
        feedback_data: cliente?.feedback_data ?? null,
        data_reuniao_cs: cliente?.data_reuniao_cs ?? null,
      });
    }
  }, [open, cliente]);

  const mut = useMutation({
    mutationFn: async () => upsert({ data: form }),
    onSuccess: (r) => {
      toast.success(r.novo ? "Cliente criado!" : "Cliente atualizado!");
      qc.invalidateQueries({ queryKey: ["clientes-base"] });
      qc.invalidateQueries({ queryKey: ["cliente", r.id] });
      onSaved?.(r.id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
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

          <Fld label="Plano">
            <Select value={form.plano ?? ""} onValueChange={(v) => set("plano", v || null)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {PLANOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
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

          <Fld label="Satisfação">
            <Select value={form.satisfacao ?? ""} onValueChange={(v) => set("satisfacao", v || null)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {SATISFACOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nome.trim()}>
            {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Salvar
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
