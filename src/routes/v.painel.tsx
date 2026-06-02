import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, LogOut, TrendingUp, Phone, Users as UsersIcon, Repeat, FileText,
  CheckCircle2, DollarSign, Save, Plus, Trash2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtInt } from "@/lib/format";
import { rangeFor, sumRegistros, toISODate, type Periodo, type VendedorRegistro } from "@/lib/vendedor-metrics";

export const Route = createFileRoute("/v/painel")({
  component: VendedorPainel,
});

function VendedorPainel() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  return <PainelInner userId={user.id} email={user.email ?? ""} onSignOut={async () => { await signOut(); navigate({ to: "/login" }); }} queryClient={queryClient} />;
}

function PainelInner({ userId, email, onSignOut, queryClient }: {
  userId: string;
  email: string;
  onSignOut: () => Promise<void>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: vendedor, isLoading: loadingVendedor } = useQuery({
    queryKey: ["vendedor-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_profiles")
        .select("id, nome, cliente_id, telefone, clientes:cliente_id(nome)")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string; nome: string; cliente_id: string; telefone: string | null;
        clientes: { nome: string } | null;
      } | null;
    },
  });

  const [periodo, setPeriodo] = useState<Periodo>("mes");

  const { data: registros, isLoading: loadingReg } = useQuery({
    queryKey: ["vendedor-registros", userId, periodo],
    queryFn: async () => {
      const { start, end } = rangeFor(periodo);
      const { data, error } = await supabase
        .from("vendedor_registros_diarios")
        .select("*")
        .eq("vendedor_user_id", userId)
        .gte("data", start)
        .lte("data", end)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendedorRegistro[];
    },
    enabled: !!vendedor,
  });

  const metricasHoje = useMemo(() => sumRegistros((registros ?? []).filter((r) => r.data === toISODate(new Date()))), [registros]);
  const metricasPeriodo = useMemo(() => sumRegistros(registros ?? []), [registros]);

  if (loadingVendedor) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso pendente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sua conta ainda não está vinculada a um cliente. Use o link de cadastro enviado pela sua agência.
            </p>
            <Button variant="outline" onClick={onSignOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-amber-500/5">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-primary-foreground shadow">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Olá, {vendedor.nome.split(" ")[0]}</p>
              <p className="text-[11px] text-muted-foreground">{vendedor.clientes?.nome ?? "Vendedor"} · {email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
        <RegistroDiarioForm
          userId={userId}
          clienteId={vendedor.cliente_id}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["vendedor-registros"] });
          }}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Seus resultados</CardTitle>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Hoje</SelectItem>
                <SelectItem value="semana">Últimos 7 dias</SelectItem>
                <SelectItem value="quinzena">Últimos 15 dias</SelectItem>
                <SelectItem value="mes">Mês atual</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loadingReg ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <MetricaCard icone={UsersIcon} cor="from-orange-500 to-amber-500" titulo="Leads recebidos" valor={fmtInt(metricasPeriodo.leads_recebidos)} hoje={fmtInt(metricasHoje.leads_recebidos)} />
                <MetricaCard icone={Phone} cor="from-blue-500 to-indigo-500" titulo="Ligações" valor={fmtInt(metricasPeriodo.ligacoes)} hoje={fmtInt(metricasHoje.ligacoes)} />
                <MetricaCard icone={Repeat} cor="from-purple-500 to-pink-500" titulo="Follow-ups" valor={fmtInt(metricasPeriodo.follow_ups)} hoje={fmtInt(metricasHoje.follow_ups)} />
                <MetricaCard icone={FileText} cor="from-cyan-500 to-blue-500" titulo="Cotações" valor={fmtInt(metricasPeriodo.cotacoes_enviadas)} hoje={fmtInt(metricasHoje.cotacoes_enviadas)} />
                <MetricaCard icone={CheckCircle2} cor="from-emerald-500 to-green-500" titulo="Vendas fechadas" valor={fmtInt(metricasPeriodo.vendas_fechadas)} hoje={fmtInt(metricasHoje.vendas_fechadas)} />
                <MetricaCard icone={DollarSign} cor="from-green-500 to-emerald-600" titulo="Faturamento bruto" valor={fmtBRL(metricasPeriodo.faturamento_bruto)} hoje={fmtBRL(metricasHoje.faturamento_bruto)} />
                <MetricaCard icone={TrendingUp} cor="from-amber-500 to-orange-500" titulo="Ticket médio" valor={fmtBRL(metricasPeriodo.ticket_medio)} />
                <MetricaCard icone={CheckCircle2} cor="from-indigo-500 to-purple-500" titulo="Conversão" valor={`${metricasPeriodo.taxa_conversao.toFixed(1)}%`} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {!registros || registros.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dia preenchido ainda no período.</p>
            ) : (
              <div className="space-y-2">
                {registros.map((r) => (
                  <div key={r.id} className="grid grid-cols-2 gap-2 rounded-lg border bg-card/60 p-3 text-xs sm:grid-cols-7">
                    <div className="font-semibold text-foreground sm:col-span-1">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</div>
                    <div><span className="text-muted-foreground">Leads:</span> <strong>{fmtInt(r.leads_recebidos)}</strong></div>
                    <div><span className="text-muted-foreground">Liga:</span> <strong>{fmtInt(r.ligacoes)}</strong></div>
                    <div><span className="text-muted-foreground">F-up:</span> <strong>{fmtInt(r.follow_ups)}</strong></div>
                    <div><span className="text-muted-foreground">Cot:</span> <strong>{fmtInt(r.cotacoes_enviadas)}</strong></div>
                    <div><span className="text-muted-foreground">Vendas:</span> <strong>{fmtInt(r.vendas_fechadas)}</strong></div>
                    <div><span className="text-muted-foreground">Fat:</span> <strong>{fmtBRL(r.faturamento_bruto)}</strong></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function MetricaCard({ icone: Icon, cor, titulo, valor, hoje }: {
  icone: typeof Phone; cor: string; titulo: string; valor: string; hoje?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${cor} opacity-20`} />
      <div className="relative">
        <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${cor} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="mt-0.5 text-xl font-bold">{valor}</p>
        {hoje !== undefined && (
          <p className="text-[10px] text-muted-foreground">Hoje: <strong className="text-foreground">{hoje}</strong></p>
        )}
      </div>
    </div>
  );
}

function RegistroDiarioForm({ userId, clienteId, onSaved }: {
  userId: string; clienteId: string; onSaved: () => void;
}) {
  const [data, setData] = useState(toISODate(new Date()));
  const [leads, setLeads] = useState(0);
  const [ligacoes, setLigacoes] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [cotacoes, setCotacoes] = useState(0);
  const [vendas, setVendas] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [obs, setObs] = useState("");
  const [motivos, setMotivos] = useState<Array<{ motivo: string; quantidade: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);

  const { data: catalogo } = useQuery({
    queryKey: ["motivos-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_motivos_perda_catalogo")
        .select("nome")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []).map((r) => r.nome);
    },
  });

  // Carregar registro existente do dia
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: row } = await supabase
        .from("vendedor_registros_diarios")
        .select("*")
        .eq("vendedor_user_id", userId)
        .eq("data", data)
        .maybeSingle();
      if (cancel) return;
      if (row) {
        setRegistroId(row.id);
        setLeads(row.leads_recebidos ?? 0);
        setLigacoes(row.ligacoes ?? 0);
        setFollowUps(row.follow_ups ?? 0);
        setCotacoes(row.cotacoes_enviadas ?? 0);
        setVendas(row.vendas_fechadas ?? 0);
        setFaturamento(Number(row.faturamento_bruto) ?? 0);
        setObs(row.observacoes ?? "");
        setMotivos(Array.isArray(row.motivos_perda) ? (row.motivos_perda as Array<{motivo:string;quantidade:number}>) : []);
      } else {
        setRegistroId(null);
        setLeads(0); setLigacoes(0); setFollowUps(0); setCotacoes(0); setVendas(0); setFaturamento(0); setObs(""); setMotivos([]);
      }
    })();
    return () => { cancel = true; };
  }, [userId, data]);

  const salvar = async () => {
    setSaving(true);
    const payload = {
      vendedor_user_id: userId,
      cliente_id: clienteId,
      data,
      leads_recebidos: leads,
      ligacoes,
      follow_ups: followUps,
      cotacoes_enviadas: cotacoes,
      vendas_fechadas: vendas,
      faturamento_bruto: faturamento,
      motivos_perda: motivos,
      observacoes: obs || null,
    };
    const { error } = await supabase
      .from("vendedor_registros_diarios")
      .upsert(payload, { onConflict: "vendedor_user_id,data" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Registro salvo!");
    onSaved();
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base">Preenchimento do dia</CardTitle>
          <p className="text-xs text-muted-foreground">{registroId ? "Atualize os números deste dia." : "Registre o que aconteceu hoje."}</p>
        </div>
        <Input type="date" className="h-9 w-44" value={data} onChange={(e) => setData(e.target.value)} max={toISODate(new Date())} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Num label="Leads recebidos" value={leads} onChange={setLeads} />
          <Num label="Ligações" value={ligacoes} onChange={setLigacoes} />
          <Num label="Follow-ups" value={followUps} onChange={setFollowUps} />
          <Num label="Cotações enviadas" value={cotacoes} onChange={setCotacoes} />
          <Num label="Vendas fechadas" value={vendas} onChange={setVendas} />
          <Num label="Faturamento bruto (R$)" value={faturamento} onChange={setFaturamento} money />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Motivos de perda</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setMotivos([...motivos, { motivo: catalogo?.[0] ?? "Outros", quantidade: 1 }])}>
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </div>
          {motivos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum motivo de perda registrado.</p>
          ) : (
            <div className="space-y-2">
              {motivos.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <Select value={m.motivo} onValueChange={(v) => setMotivos(motivos.map((mm, i) => i === idx ? { ...mm, motivo: v } : mm))}>
                    <SelectTrigger className="col-span-7 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalogo ?? []).map((nome) => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} className="col-span-3 h-9" value={m.quantidade}
                    onChange={(e) => setMotivos(motivos.map((mm, i) => i === idx ? { ...mm, quantidade: Number(e.target.value) || 0 } : mm))} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-2 h-9 text-destructive" onClick={() => setMotivos(motivos.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações (opcional)</Label>
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Alguma observação sobre o dia..." />
        </div>

        <Button onClick={salvar} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {registroId ? "Atualizar" : "Salvar dia"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Num({ label, value, onChange, money }: { label: string; value: number; onChange: (v: number) => void; money?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        min={0}
        step={money ? "0.01" : "1"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9"
      />
    </div>
  );
}
