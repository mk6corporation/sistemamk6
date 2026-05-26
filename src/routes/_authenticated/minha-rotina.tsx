import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarClock, CheckCircle2, AlertTriangle, Sparkles, Loader2, MessageCircle, ListChecks,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/minha-rotina")({
  component: MinhaRotina,
});

function normalize(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

type OperacionalMember = { id?: string; name?: string };

type ClienteLite = {
  id: string;
  nome: string;
  operacional: OperacionalMember[] | null;
  removido_em: string | null;
};

type StepRow = {
  id: string;
  cliente_id: string;
  titulo: string;
  fase: string;
  tipo: string;
  status: string;
  data_prevista: string | null;
  tem_trava: boolean;
  cliente_entregue: boolean;
  mk6_entregue: boolean;
};

type CheckinRow = {
  id: string;
  cliente_id: string;
  data: string;
};

function MinhaRotina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: viewer } = useQuery({
    enabled: !!user,
    queryKey: ["viewer-rotina", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome,email")
        .eq("user_id", user!.id)
        .maybeSingle();
      return { nome: profile?.nome ?? null, email: profile?.email ?? null };
    },
  });

  const { data: clientes } = useQuery({
    enabled: !!viewer,
    queryKey: ["meus-clientes-rotina", viewer?.nome],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome,operacional,removido_em");
      if (error) throw error;
      const myName = normalize(viewer?.nome);
      if (!myName) return [];
      return ((data ?? []) as ClienteLite[]).filter(
        (c) =>
          !c.removido_em &&
          (c.operacional ?? []).some(
            (m) =>
              normalize(m?.name).includes(myName) || myName.includes(normalize(m?.name)),
          ),
      );
    },
  });

  const clienteIds = useMemo(() => (clientes ?? []).map((c) => c.id), [clientes]);

  const { data: steps, isLoading: stepsLoading } = useQuery({
    enabled: clienteIds.length > 0,
    queryKey: ["rotina-steps", clienteIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_timeline_steps")
        .select("id,cliente_id,titulo,fase,tipo,status,data_prevista,tem_trava,cliente_entregue,mk6_entregue")
        .in("cliente_id", clienteIds)
        .neq("status", "concluido")
        .order("data_prevista", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StepRow[];
    },
  });

  const { data: checkinsHoje } = useQuery({
    enabled: clienteIds.length > 0,
    queryKey: ["rotina-checkins-hoje", clienteIds, hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_checkins")
        .select("id,cliente_id,data")
        .in("cliente_id", clienteIds)
        .eq("data", hoje);
      if (error) throw error;
      return (data ?? []) as CheckinRow[];
    },
  });

  const checkinDoneIds = useMemo(
    () => new Set((checkinsHoje ?? []).map((c) => c.cliente_id)),
    [checkinsHoje],
  );

  const nomeCliente = (id: string) => clientes?.find((c) => c.id === id)?.nome ?? "—";

  const atrasados = (steps ?? []).filter((s) => s.data_prevista && s.data_prevista < hoje);
  const paraHoje = (steps ?? []).filter((s) => s.data_prevista === hoje);
  const proximos = (steps ?? []).filter((s) => s.data_prevista && s.data_prevista > hoje).slice(0, 8);

  const registrarCheckin = useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase.from("cliente_checkins").insert({
        cliente_id: clienteId,
        data: hoje,
        tipo: "checkin_whatsapp",
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

  const concluirStep = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase
        .from("cliente_timeline_steps")
        .update({ status: "concluido", data_concluida: new Date().toISOString(), mk6_entregue: true })
        .eq("id", stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Step concluído!");
      qc.invalidateQueries({ queryKey: ["rotina-steps"] });
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
          {clientes?.length ?? 0} cliente(s) sob sua gestão · {hoje}
        </p>
      </div>

      {/* Demandas diárias obrigatórias: check-in WhatsApp por cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            Check-in diário obrigatório (WhatsApp)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Toda manhã: registrar um check-in com cada cliente ativo.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(clientes ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Você não tem clientes atribuídos.
            </p>
          ) : (
            (clientes ?? []).map((c) => {
              const done = checkinDoneIds.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                    done ? "border-emerald-500/30 bg-emerald-500/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={done}
                      disabled={done || registrarCheckin.isPending}
                      onCheckedChange={(v) => {
                        if (v && !done) registrarCheckin.mutate(c.id);
                      }}
                    />
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: c.id }}
                      className="text-sm font-medium hover:underline"
                    >
                      {c.nome}
                    </Link>
                  </div>
                  {done ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Feito hoje
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

      {/* Steps atrasados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Atrasadas ({atrasados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stepsLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : atrasados.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma demanda em atraso 🎉</p>
          ) : (
            atrasados.map((s) => <StepLine key={s.id} step={s} nome={nomeCliente(s.cliente_id)} onConcluir={() => concluirStep.mutate(s.id)} atrasado />)
          )}
        </CardContent>
      </Card>

      {/* Para hoje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" />
            Para hoje ({paraHoje.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paraHoje.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sem demandas previstas para hoje.</p>
          ) : (
            paraHoje.map((s) => <StepLine key={s.id} step={s} nome={nomeCliente(s.cliente_id)} onConcluir={() => concluirStep.mutate(s.id)} />)
          )}
        </CardContent>
      </Card>

      {/* Próximas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas demandas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {proximos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nada na fila.</p>
          ) : (
            proximos.map((s) => <StepLine key={s.id} step={s} nome={nomeCliente(s.cliente_id)} onConcluir={() => concluirStep.mutate(s.id)} />)
          )}
        </CardContent>
      </Card>

      {/* Placeholder Google Calendar */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Integração com Google Calendar (em breve)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Para sincronizar os eventos da sua agenda Google aqui, precisamos configurar OAuth próprio (Client ID + Secret no Google Cloud Console) — assim cada colaborador conecta sua própria conta. Me avise quando quiser ativar.
        </CardContent>
      </Card>
    </div>
  );
}

function StepLine({
  step, nome, onConcluir, atrasado,
}: {
  step: StepRow; nome: string; onConcluir: () => void; atrasado?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${atrasado ? "border-red-500/30 bg-red-500/5" : "bg-card"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/clientes/$clienteId" params={{ clienteId: step.cliente_id }} className="font-medium text-foreground hover:underline">
            {nome}
          </Link>
          <span>·</span>
          <span>{step.fase}</span>
          {step.data_prevista && (
            <>
              <span>·</span>
              <span className={atrasado ? "text-red-600 font-medium" : ""}>
                {new Date(step.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
            </>
          )}
        </div>
        <p className="text-sm">{step.titulo}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onConcluir}>
        <CheckCircle2 className="mr-1 h-4 w-4" /> Concluir
      </Button>
    </div>
  );
}
