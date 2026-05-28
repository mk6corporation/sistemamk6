import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarClock, CheckCircle2, AlertTriangle, Sparkles, Loader2,
  MessageCircle, Clock, Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { avancarStep } from "@/lib/journey.functions";

export const Route = createFileRoute("/_authenticated/minha-rotina")({
  component: MinhaRotina,
});

function normalize(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

type OperacionalMember = { id?: string; name?: string };
type ClienteLite = {
  id: string; nome: string;
  operacional: OperacionalMember[] | null;
  removido_em: string | null;
  categoria: string | null;
};

type StepRow = {
  id: string; cliente_id: string; ordem: number; titulo: string; fase: string;
  status: string; data_prevista: string | null;
  tem_trava: boolean; cliente_entregue: boolean;
  acao_mk6_itens: Array<{ texto: string; concluido: boolean }> | null;
  pronto_para_avancar: boolean; atrasado: boolean;
};

type CheckinRow = { id: string; cliente_id: string; data: string };

function MinhaRotina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const avancarFn = useServerFn(avancarStep);

  const { data: viewer } = useQuery({
    enabled: !!user,
    queryKey: ["viewer-rotina", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles").select("nome,email").eq("user_id", user!.id).maybeSingle();
      return { nome: profile?.nome ?? null, email: profile?.email ?? null };
    },
  });

  const { data: clientes } = useQuery({
    enabled: !!viewer,
    queryKey: ["meus-clientes-rotina", viewer?.nome],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("id,nome,operacional,removido_em,categoria");
      if (error) throw error;
      const myName = normalize(viewer?.nome);
      if (!myName) return [];
      return ((data ?? []) as ClienteLite[]).filter(
        (c) => !c.removido_em && c.categoria === "ATIVO" &&
          (c.operacional ?? []).some(
            (m) => normalize(m?.name).includes(myName) || myName.includes(normalize(m?.name)),
          ),
      );
    },
  });

  const clienteIds = useMemo(() => (clientes ?? []).map((c) => c.id), [clientes]);

  const { data: steps, isLoading: stepsLoading } = useQuery({
    enabled: clienteIds.length > 0,
    queryKey: ["rotina-steps-v2", clienteIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("id,cliente_id,ordem,titulo,fase,status,data_prevista,tem_trava,cliente_entregue,acao_mk6_itens,pronto_para_avancar,atrasado")
        .in("cliente_id", clienteIds)
        .neq("status", "concluido")
        .eq("bloqueado", false)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StepRow[];
    },
  });

  const { data: checkinsHoje } = useQuery({
    enabled: clienteIds.length > 0,
    queryKey: ["rotina-checkins-hoje", clienteIds, hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_checkins").select("id,cliente_id,data")
        .in("cliente_id", clienteIds).eq("data", hoje);
      if (error) throw error;
      return (data ?? []) as CheckinRow[];
    },
  });

  const checkinDoneIds = useMemo(
    () => new Set((checkinsHoje ?? []).map((c) => c.cliente_id)),
    [checkinsHoje],
  );

  const nomeCliente = (id: string) =>
    clientes?.find((c) => c.id === id)?.nome ?? "—";

  // Classifica step atual de cada cliente em verde/amarelo/vermelho/pronto
  type Bucket = "vermelho" | "verde" | "amarelo" | "pronto";
  function bucketOf(s: StepRow): Bucket {
    if (s.atrasado) return "vermelho";
    if (s.pronto_para_avancar) return "pronto";
    const itens = Array.isArray(s.acao_mk6_itens) ? s.acao_mk6_itens : [];
    const acaoOk = itens.length === 0 || itens.every((i) => i.concluido);
    if (acaoOk && s.tem_trava && !s.cliente_entregue) return "amarelo";
    return "verde";
  }

  const grupos = useMemo(() => {
    const g: Record<Bucket, StepRow[]> = { vermelho: [], pronto: [], verde: [], amarelo: [] };
    for (const s of steps ?? []) g[bucketOf(s)].push(s);
    return g;
  }, [steps]);

  const registrarCheckin = useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase.from("cliente_checkins").insert({
        cliente_id: clienteId, data: hoje, tipo: "checkin_whatsapp",
        registrado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in registrado!");
      qc.invalidateQueries({ queryKey: ["rotina-checkins-hoje"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAcao = useMutation({
    mutationFn: async ({ step, idx }: { step: StepRow; idx: number }) => {
      const itens = Array.isArray(step.acao_mk6_itens) ? [...step.acao_mk6_itens] : [];
      itens[idx] = { ...itens[idx], concluido: !itens[idx].concluido };
      const acaoOk = itens.every((i) => i.concluido);
      const clienteOk = !step.tem_trava || step.cliente_entregue;
      const { error } = await supabase
        .from("cliente_timeline_steps")
        .update({ acao_mk6_itens: itens, pronto_para_avancar: acaoOk && clienteOk })
        .eq("id", step.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rotina-steps-v2"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const avancar = useMutation({
    mutationFn: (stepId: string) => avancarFn({ data: { stepId } }),
    onSuccess: () => {
      toast.success("Step avançado!");
      qc.invalidateQueries({ queryKey: ["rotina-steps-v2"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarClock className="h-6 w-6 text-primary" /> Minha Rotina
        </h1>
        <p className="text-sm text-muted-foreground">
          {viewer?.nome ? `Olá, ${viewer.nome}. ` : ""}
          {clientes?.length ?? 0} cliente(s) ativos · {hoje}
        </p>
      </div>

      {/* Check-in diário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            Check-in diário (WhatsApp)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Toda manhã: 1 check-in por cliente ativo.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(clientes ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem clientes atribuídos.</p>
          ) : (
            (clientes ?? []).map((c) => {
              const done = checkinDoneIds.has(c.id);
              return (
                <div key={c.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${done ? "border-emerald-500/30 bg-emerald-500/5" : "bg-card"}`}>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={done} disabled={done || registrarCheckin.isPending}
                      onCheckedChange={(v) => { if (v && !done) registrarCheckin.mutate(c.id); }} />
                    <Link to="/clientes/$clienteId" params={{ clienteId: c.id }}
                      className="text-sm font-medium hover:underline">{c.nome}</Link>
                  </div>
                  {done ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Feito
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <BucketCard
        title="🔴 Atrasados"
        subtitle="Step com data prevista já vencida — destrava aqui primeiro."
        color="red"
        steps={grupos.vermelho}
        nomeCliente={nomeCliente}
        toggleAcao={toggleAcao}
        avancar={avancar}
        loading={stepsLoading}
      />
      <BucketCard
        title="🔵 Prontos para avançar"
        subtitle="Ação MK6 concluída + cliente entregou. Clique em Avançar."
        color="blue"
        steps={grupos.pronto}
        nomeCliente={nomeCliente}
        toggleAcao={toggleAcao}
        avancar={avancar}
        loading={stepsLoading}
      />
      <BucketCard
        title="🟢 Ação pendente (MK6)"
        subtitle="A bola está com você — conclua a Ação MK6."
        color="green"
        steps={grupos.verde}
        nomeCliente={nomeCliente}
        toggleAcao={toggleAcao}
        avancar={avancar}
        loading={stepsLoading}
      />
      <BucketCard
        title="🟡 Aguardando cliente"
        subtitle="Sua parte está feita. Acompanhe a entrega do cliente."
        color="amber"
        steps={grupos.amarelo}
        nomeCliente={nomeCliente}
        toggleAcao={toggleAcao}
        avancar={avancar}
        loading={stepsLoading}
      />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Google Calendar (em breve)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Conecte sua agenda Google para ver os eventos aqui — me avise quando quiser ativar.
        </CardContent>
      </Card>
    </div>
  );
}

function BucketCard({
  title, subtitle, color, steps, loading, nomeCliente, toggleAcao, avancar,
}: {
  title: string;
  subtitle: string;
  color: "red" | "green" | "amber" | "blue";
  steps: StepRow[];
  loading: boolean;
  nomeCliente: (id: string) => string;
  toggleAcao: ReturnType<typeof useMutation<any, any, { step: StepRow; idx: number }>>;
  avancar: ReturnType<typeof useMutation<any, any, string>>;
}) {
  const ICON = color === "red" ? AlertTriangle : color === "amber" ? Hourglass : color === "blue" ? CheckCircle2 : Clock;
  const iconCls =
    color === "red" ? "text-red-600" :
    color === "amber" ? "text-amber-600" :
    color === "blue" ? "text-primary" : "text-emerald-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ICON className={`h-4 w-4 ${iconCls}`} /> {title} ({steps.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : steps.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nada por aqui.</p>
        ) : (
          steps.map((s) => (
            <StepRowItem key={s.id} step={s} nome={nomeCliente(s.cliente_id)}
              onToggle={(idx) => toggleAcao.mutate({ step: s, idx })}
              onAvancar={() => avancar.mutate(s.id)} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StepRowItem({
  step, nome, onToggle, onAvancar,
}: { step: StepRow; nome: string; onToggle: (idx: number) => void; onAvancar: () => void }) {
  const itens = Array.isArray(step.acao_mk6_itens) ? step.acao_mk6_itens : [];
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/clientes/$clienteId" params={{ clienteId: step.cliente_id }}
              className="font-medium text-foreground hover:underline">{nome}</Link>
            <span>·</span><span>Step {step.ordem}</span>
            {step.data_prevista && (
              <>
                <span>·</span>
                <span className={step.atrasado ? "font-medium text-red-600" : ""}>
                  prev. {new Date(step.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              </>
            )}
          </div>
          <p className="text-sm font-medium">{step.titulo}</p>
        </div>
        {step.pronto_para_avancar && (
          <Button size="sm" onClick={onAvancar}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Avançar
          </Button>
        )}
      </div>
      {itens.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t pt-2">
          {itens.map((it, idx) => (
            <label key={idx} className="flex items-start gap-2 text-sm">
              <Checkbox checked={it.concluido} onCheckedChange={() => onToggle(idx)} className="mt-0.5" />
              <span className={it.concluido ? "text-muted-foreground line-through" : ""}>{it.texto}</span>
            </label>
          ))}
        </div>
      )}
      {step.tem_trava && !step.cliente_entregue && (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <Hourglass className="h-3 w-3" /> Aguardando entrega do cliente (trava).
        </p>
      )}
    </div>
  );
}
