import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, CalendarDays, Sparkles, Lock, CheckCircle2, Clock, AlertTriangle,
  RotateCcw, ArrowRight, Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { MK6_JOURNEY, tipoLabel, tipoColor, addDays, type MK6Tipo } from "@/lib/mk6-journey";
import { avancarStep } from "@/lib/journey.functions";


type Step = {
  id: string;
  cliente_id: string;
  ordem: number;
  codigo: string;
  fase: string;
  semana: number | null;
  dia_inicio: number | null;
  dia_fim: number | null;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  tipo: string;
  responsavel: string | null;
  mk6_responsabilidade: string | null;
  mk6_entregue: boolean;
  cliente_responsabilidade: string | null;
  cliente_entregue: boolean;
  tem_trava: boolean;
  trava_descricao: string | null;
  data_prevista: string | null;
  data_concluida: string | null;
  status: string;
  observacoes: string | null;
};

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "atrasado", label: "Atrasado" },
];

function statusBadge(status: string, dataPrevista: string | null) {
  const hoje = new Date().toISOString().slice(0, 10);
  let s = status;
  if (s !== "concluido" && dataPrevista && dataPrevista < hoje) s = "atrasado";
  switch (s) {
    case "concluido":
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Concluído</Badge>;
    case "em_andamento":
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300" variant="outline"><Clock className="mr-1 h-3 w-3" />Em andamento</Badge>;
    case "atrasado":
      return <Badge className="bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300" variant="outline"><AlertTriangle className="mr-1 h-3 w-3" />Atrasado</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
  }
}

export function TimelineTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();

  const stepsQuery = useQuery({
    queryKey: ["timeline", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Step[];
    },
  });

  const [dataInicio, setDataInicio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [applyOpen, setApplyOpen] = useState(false);

  const aplicar = useMutation({
    mutationFn: async () => {
      const rows = MK6_JOURNEY.map((t) => ({
        cliente_id: clienteId,
        ordem: t.ordem,
        codigo: t.codigo,
        fase: t.fase,
        semana: t.semana,
        dia_inicio: t.dia_inicio,
        dia_fim: t.dia_fim,
        titulo: t.titulo,
        subtitulo: t.subtitulo ?? null,
        descricao: t.descricao,
        tipo: t.tipo,
        responsavel: t.responsavel,
        mk6_responsabilidade: t.mk6_responsabilidade,
        cliente_responsabilidade: t.cliente_responsabilidade,
        tem_trava: t.tem_trava,
        trava_descricao: t.trava_descricao ?? null,
        data_prevista: addDays(dataInicio, t.dia_fim),
        status: "pendente",
      }));
      const { error } = await supabase.from("cliente_timeline_steps").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("MK6 Journey aplicada!");
      qc.invalidateQueries({ queryKey: ["timeline", clienteId] });
      setApplyOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const limpar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cliente_timeline_steps").delete().eq("cliente_id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Linha do tempo removida");
      qc.invalidateQueries({ queryKey: ["timeline", clienteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (stepsQuery.isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const steps = stepsQuery.data ?? [];

  if (steps.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Linha do tempo vazia</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Aplique o template <strong>MK6 Journey</strong> (90 dias, 15 etapas em 3 fases) para gerar
              automaticamente todas as calls, marcos e responsabilidades deste cliente.
            </p>
          </div>
          <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
            <DialogTrigger asChild>
              <Button><Sparkles className="mr-2 h-4 w-4" />Aplicar MK6 Journey</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aplicar MK6 Journey</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Label>Data de início do projeto (Dia 1)</Label>
                <Input
                  type="date" value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  As datas previstas das 15 etapas serão calculadas a partir desta data.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setApplyOpen(false)}>Cancelar</Button>
                <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
                  {aplicar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Aplicar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por fase
  const fases = Array.from(new Set(steps.map((s) => s.fase)));
  const totalConcluidos = steps.filter((s) => s.status === "concluido").length;
  const progresso = Math.round((totalConcluidos / steps.length) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" /> MK6 Journey
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalConcluidos} de {steps.length} etapas concluídas · {progresso}%
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1 h-4 w-4" /> Reaplicar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reaplicar linha do tempo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai <strong>remover</strong> todos os steps atuais (incluindo conclusões e observações)
                  e te deixar aplicar a MK6 Journey novamente com nova data de início.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => limpar.mutate()}>
                  Remover linha do tempo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {fases.map((fase) => (
        <div key={fase} className="space-y-3">
          <h3 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {fase}
          </h3>
          {steps
            .filter((s) => s.fase === fase)
            .map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
        </div>
      ))}
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  const qc = useQueryClient();
  const [obs, setObs] = useState(step.observacoes ?? "");
  const tipo = step.tipo as MK6Tipo;

  const update = useMutation({
    mutationFn: async (patch: Partial<Step>) => {
      const { error } = await supabase
        .from("cliente_timeline_steps").update(patch).eq("id", step.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline", step.cliente_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const podeConcluir = !step.tem_trava || step.cliente_entregue;

  const onMarkConcluido = () => {
    if (!podeConcluir) {
      toast.error("Trava de avanço ativa: marque a responsabilidade do cliente como entregue antes de concluir.");
      return;
    }
    update.mutate({
      status: "concluido",
      data_concluida: new Date().toISOString(),
      mk6_entregue: true,
    });
  };

  return (
    <Card className={step.status === "concluido" ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={tipoColor(tipo)}>{tipoLabel(tipo)}</Badge>
              {step.semana && <Badge variant="secondary" className="text-xs">Semana {step.semana}</Badge>}
              <span className="text-xs text-muted-foreground">
                Dia {step.dia_inicio}{step.dia_fim !== step.dia_inicio ? `–${step.dia_fim}` : ""}
                {step.data_prevista && ` · prev. ${new Date(step.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}`}
              </span>
              {step.tem_trava && (
                <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
                  <Lock className="mr-1 h-3 w-3" />Trava
                </Badge>
              )}
            </div>
            <CardTitle className="text-base">{step.titulo}</CardTitle>
            {step.subtitulo && <p className="text-xs text-muted-foreground">{step.subtitulo}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {statusBadge(step.status, step.data_prevista)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.descricao && <p className="text-sm text-muted-foreground">{step.descricao}</p>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">MK6</span>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={step.mk6_entregue}
                  onCheckedChange={(v) => update.mutate({
                    mk6_entregue: !!v,
                    mk6_entregue_em: v ? new Date().toISOString() : null,
                  } as any)}
                />
                Entregue
              </label>
            </div>
            <p className="text-sm">{step.mk6_responsabilidade}</p>
          </div>

          <div className={`rounded-lg border p-3 ${step.tem_trava ? "border-amber-500/40 bg-amber-500/5" : "bg-card"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Cliente</span>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={step.cliente_entregue}
                  onCheckedChange={(v) => update.mutate({
                    cliente_entregue: !!v,
                    cliente_entregue_em: v ? new Date().toISOString() : null,
                  } as any)}
                />
                Entregue
              </label>
            </div>
            <p className="text-sm">{step.cliente_responsabilidade}</p>
            {step.tem_trava && step.trava_descricao && (
              <p className="mt-2 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" /> {step.trava_descricao}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={step.status} onValueChange={(v) => update.mutate({ status: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Data prevista</Label>
            <Input
              type="date" className="w-44"
              value={step.data_prevista ?? ""}
              onChange={(e) => update.mutate({ data_prevista: e.target.value || null })}
            />
          </div>
          {step.status !== "concluido" && (
            <Button size="sm" onClick={onMarkConcluido} disabled={!podeConcluir}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar concluído
            </Button>
          )}
          <div className="flex-1 min-w-[240px] space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Observações</Label>
            <Textarea
              rows={1} className="min-h-9 resize-none"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onBlur={() => { if (obs !== (step.observacoes ?? "")) update.mutate({ observacoes: obs }); }}
              placeholder="Notas, ajustes, links..."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
