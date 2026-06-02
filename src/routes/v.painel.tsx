import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, LogOut, TrendingUp, Phone, Users as UsersIcon, Repeat, Send,
  Trophy, DollarSign, Save, Plus, Trash2, Clock, Activity, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtInt } from "@/lib/format";
import {
  rangeFor, sumRegistros, toISODate, evolucaoSemana,
  type Periodo, type VendedorRegistro,
} from "@/lib/vendedor-metrics";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/v/painel")({
  component: VendedorPainel,
});

const PENDING_VENDOR_LINK_KEY = "mk6_pending_vendor_link";

type PendingVendorLink = {
  slug: string;
  nome?: string;
  telefone?: string;
  email?: string;
};

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

  return (
    <PainelInner
      userId={user.id}
      email={user.email ?? ""}
      onSignOut={async () => { await signOut(); navigate({ to: "/login" }); }}
      queryClient={queryClient}
    />
  );
}

function PainelInner({ userId, email, onSignOut, queryClient }: {
  userId: string;
  email: string;
  onSignOut: () => Promise<void>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [linkingProfile, setLinkingProfile] = useState(false);
  const { data: vendedor, isLoading: loadingVendedor } = useQuery({
    queryKey: ["vendedor-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_profiles")
        .select("id, nome, cliente_id, telefone")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", data.cliente_id)
        .maybeSingle();

      return {
        ...data,
        clientes: cliente ? { nome: cliente.nome } : null,
      } as {
        id: string; nome: string; cliente_id: string; telefone: string | null;
        clientes: { nome: string } | null;
      };
    },
  });

  const [periodo, setPeriodo] = useState<Periodo>("dia");

  const { data: registros30 } = useQuery({
    queryKey: ["vendedor-registros-30", userId],
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const { data, error } = await supabase
        .from("vendedor_registros_diarios")
        .select("*")
        .eq("vendedor_user_id", userId)
        .gte("data", toISODate(start))
        .lte("data", toISODate(end))
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VendedorRegistro[];
    },
    enabled: !!vendedor,
  });

  const { data: registrosPeriodo } = useQuery({
    queryKey: ["vendedor-registros-periodo", userId, periodo],
    queryFn: async () => {
      const { start, end } = rangeFor(periodo);
      const { data, error } = await supabase
        .from("vendedor_registros_diarios")
        .select("*")
        .eq("vendedor_user_id", userId)
        .gte("data", start)
        .lte("data", end);
      if (error) throw error;
      return (data ?? []) as unknown as VendedorRegistro[];
    },
    enabled: !!vendedor,
  });

  const metricasPeriodo = useMemo(() => sumRegistros(registrosPeriodo ?? []), [registrosPeriodo]);
  const semana = useMemo(() => evolucaoSemana(registros30 ?? []), [registros30]);
  const ultimos30Dias = useMemo(() => (registros30 ?? []).slice(0, 30), [registros30]);

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
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-bold">Acesso pendente</h2>
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

  const hoje = new Date();
  const labelPeriodo: Record<Periodo, string> = {
    dia: "HOJE",
    semana: "ÚLTIMOS 7 DIAS",
    quinzena: "ÚLTIMOS 15 DIAS",
    mes: "MÊS ATUAL",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-indigo-50/40 dark:from-slate-950 dark:via-background dark:to-indigo-950/30">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Olá, {vendedor.nome.split(" ")[0]} 👋</p>
              <p className="text-[11px] text-muted-foreground">{vendedor.clientes?.nome ?? ""} · {email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* KPIs no topo (estilo print) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground">{labelPeriodo[periodo]}</p>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Hoje</SelectItem>
                <SelectItem value="semana">Últimos 7 dias</SelectItem>
                <SelectItem value="quinzena">Últimos 15 dias</SelectItem>
                <SelectItem value="mes">Mês atual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCardHero
              titulo="Faturamento"
              valor={fmtBRL(metricasPeriodo.faturamento_bruto)}
              icone={DollarSign}
              sub={`Ticket ${fmtBRL(metricasPeriodo.ticket_medio)}`}
            />
            <KpiCard
              titulo="Fechamentos"
              valor={fmtInt(metricasPeriodo.vendas_fechadas)}
              icone={Trophy}
              cor="text-amber-600 bg-amber-50 dark:bg-amber-950/40"
              sub={`${fmtInt(metricasPeriodo.cotacoes_enviadas)} propostas`}
            />
            <KpiCard
              titulo="Taxa fechamento"
              valor={`${metricasPeriodo.taxa_fechamento.toFixed(1)}%`}
              icone={TrendingUp}
              cor="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
              sub={`${fmtInt(metricasPeriodo.vendas_fechadas)}/${fmtInt(metricasPeriodo.cotacoes_enviadas)} cotações`}
            />
            <KpiCard
              titulo="Taxa contato"
              valor={`${metricasPeriodo.taxa_contato.toFixed(1)}%`}
              icone={Activity}
              cor="text-violet-600 bg-violet-50 dark:bg-violet-950/40"
              sub={`${fmtInt(metricasPeriodo.contatados_total)}/${fmtInt(metricasPeriodo.leads_recebidos)} leads`}
            />
          </div>
        </section>

        <RegistroDiarioForm
          userId={userId}
          clienteId={vendedor.cliente_id}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["vendedor-registros-30"] });
            queryClient.invalidateQueries({ queryKey: ["vendedor-registros-periodo"] });
          }}
        />

        {/* Evolução desta semana */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-bold">Evolução desta semana</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={semana.map((d) => ({
                  dia: d.label,
                  vendas: d.somado.vendas_fechadas,
                  propostas: d.somado.cotacoes_enviadas,
                  leads: d.somado.leads_recebidos,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="propostas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="vendas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <Legend cor="#6366f1" label="Leads" />
              <Legend cor="#f59e0b" label="Propostas" />
              <Legend cor="#10b981" label="Vendas" />
            </div>
          </CardContent>
        </Card>

        {/* Últimos 30 dias */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Últimos 30 dias</h3>
            {ultimos30Dias.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Leads</th>
                      <th className="py-2 pr-3">Contatos ≤2h</th>
                      <th className="py-2 pr-3">Propostas</th>
                      <th className="py-2 pr-3">Fech.</th>
                      <th className="py-2 pr-3">Faturamento</th>
                      <th className="py-2 pr-3 text-right">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimos30Dias.map((r) => {
                      const conv = r.cotacoes_enviadas > 0 ? (r.vendas_fechadas / r.cotacoes_enviadas) * 100 : 0;
                      return (
                        <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="py-2 pr-3 font-medium">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="py-2 pr-3">{fmtInt(r.leads_recebidos)}</td>
                          <td className="py-2 pr-3">{fmtInt(r.contatados_2h)}</td>
                          <td className="py-2 pr-3">{fmtInt(r.cotacoes_enviadas)}</td>
                          <td className="py-2 pr-3 font-semibold text-emerald-600">{fmtInt(r.vendas_fechadas)}</td>
                          <td className="py-2 pr-3 font-semibold">{fmtBRL(Number(r.faturamento_bruto))}</td>
                          <td className="py-2 pr-3 text-right">{conv.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="pb-4 text-center text-[11px] text-muted-foreground">
          Hoje é {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}.
          Preencha um pouquinho todo dia 💪
        </p>
      </main>
    </div>
  );
}

function Legend({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: cor }} /> {label}
    </span>
  );
}

function KpiCardHero({ titulo, valor, sub, icone: Icon }: {
  titulo: string; valor: string; sub?: string; icone: typeof DollarSign;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-4 text-white shadow-xl shadow-indigo-500/30">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">{titulo}</p>
          <p className="mt-1 text-2xl font-bold">{valor}</p>
          {sub && <p className="mt-0.5 text-[11px] text-white/70">{sub}</p>}
        </div>
        <div className="rounded-lg bg-white/15 p-2">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ titulo, valor, sub, icone: Icon, cor }: {
  titulo: string; valor: string; sub?: string; icone: typeof Trophy; cor: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{titulo}</p>
          <p className="mt-1 text-2xl font-bold">{valor}</p>
          {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${cor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function RegistroDiarioForm({ userId, clienteId, onSaved }: {
  userId: string; clienteId: string; onSaved: () => void;
}) {
  const [data, setData] = useState(toISODate(new Date()));
  const [leads, setLeads] = useState(0);
  const [contatados2h, setContatados2h] = useState(0);
  const [contatadosApos, setContatadosApos] = useState(0);
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
        setContatados2h((row as any).contatados_2h ?? 0);
        setContatadosApos((row as any).contatados_apos_2h ?? 0);
        setLigacoes(row.ligacoes ?? 0);
        setFollowUps(row.follow_ups ?? 0);
        setCotacoes(row.cotacoes_enviadas ?? 0);
        setVendas(row.vendas_fechadas ?? 0);
        setFaturamento(Number(row.faturamento_bruto) ?? 0);
        setObs(row.observacoes ?? "");
        setMotivos(Array.isArray(row.motivos_perda) ? (row.motivos_perda as Array<{motivo:string;quantidade:number}>) : []);
      } else {
        setRegistroId(null);
        setLeads(0); setContatados2h(0); setContatadosApos(0);
        setLigacoes(0); setFollowUps(0); setCotacoes(0); setVendas(0);
        setFaturamento(0); setObs(""); setMotivos([]);
      }
    })();
    return () => { cancel = true; };
  }, [userId, data]);

  const taxaContato = leads > 0 ? ((contatados2h + contatadosApos) / leads) * 100 : 0;
  const taxaFech = cotacoes > 0 ? (vendas / cotacoes) * 100 : 0;

  const salvar = async () => {
    setSaving(true);
    const payload: any = {
      vendedor_user_id: userId,
      cliente_id: clienteId,
      data,
      leads_recebidos: leads,
      contatados_2h: contatados2h,
      contatados_apos_2h: contatadosApos,
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
    toast.success("Lançamento salvo! 🎉");
    onSaved();
  };

  const dataLabel = new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <Card className="overflow-hidden border-2 border-indigo-500/15 shadow-lg">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Lançamento do dia</h3>
            <p className="text-xs text-muted-foreground capitalize">{dataLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 border-violet-500/40 text-violet-700 dark:text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Contato {taxaContato.toFixed(1)}%
            </Badge>
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Fechamento {taxaFech.toFixed(1)}%
            </Badge>
            <Input
              type="date"
              className="h-9 w-44"
              value={data}
              onChange={(e) => setData(e.target.value)}
              max={toISODate(new Date())}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Num label="Leads recebidos" icone={UsersIcon} value={leads} onChange={setLeads} />
          <Num label="Contatados em ≤ 2h" icone={Clock} value={contatados2h} onChange={setContatados2h} />
          <Num label="Contatados após 2h" icone={Clock} value={contatadosApos} onChange={setContatadosApos} />
          <Num label="Ligações realizadas" icone={Phone} value={ligacoes} onChange={setLigacoes} />
          <Num label="Propostas enviadas" icone={Send} value={cotacoes} onChange={setCotacoes} />
          <Num label="Follow-ups" icone={Repeat} value={followUps} onChange={setFollowUps} />
          <Num label="Fechamentos" icone={Trophy} value={vendas} onChange={setVendas} />
          <div className="col-span-2 space-y-1">
            <Label className="text-[11px] flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor total vendido (R$)</Label>
            <Input type="number" min={0} step="0.01" value={faturamento}
              onChange={(e) => setFaturamento(Number(e.target.value) || 0)} className="h-9" />
          </div>
        </div>

        {/* Motivos de perda */}
        <div className="rounded-lg border border-dashed bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Motivos de perda das cotações não fechadas</Label>
              <p className="text-[10px] text-muted-foreground">Ajude a mapear o que mais segura as vendas.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setMotivos([...motivos, { motivo: catalogo?.[0] ?? "Outros", quantidade: 1 }])}>
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </div>
          {motivos.length > 0 && (
            <div className="mt-3 space-y-2">
              {motivos.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <Select value={m.motivo} onValueChange={(v) => setMotivos(motivos.map((mm, i) => i === idx ? { ...mm, motivo: v } : mm))}>
                    <SelectTrigger className="col-span-7 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(catalogo ?? []).map((nome) => <SelectItem key={nome} value={nome}>{nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} className="col-span-3 h-9" value={m.quantidade}
                    onChange={(e) => setMotivos(motivos.map((mm, i) => i === idx ? { ...mm, quantidade: Number(e.target.value) || 0 } : mm))} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-2 h-9 text-destructive"
                    onClick={() => setMotivos(motivos.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações do dia</Label>
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Algo a destacar?" />
        </div>

        <Button onClick={salvar} disabled={saving} size="lg" className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {registroId ? "Atualizar lançamento" : "Salvar lançamento"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Num({ label, value, onChange, icone: Icon }: {
  label: string; value: number; onChange: (v: number) => void; icone?: typeof Phone;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9"
      />
    </div>
  );
}
