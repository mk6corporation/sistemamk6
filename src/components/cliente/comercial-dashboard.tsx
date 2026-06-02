import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL, fmtInt } from "@/lib/format";
import {
  Users as UsersIcon, Phone, Send, Repeat, Trophy, DollarSign,
  Clock, Activity, AlertTriangle, BarChart3, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  sumRegistros, agruparMotivosPerda, agruparPorDia,
  type VendedorRegistro,
} from "@/lib/vendedor-metrics";

type Vendedor = { user_id: string; nome: string };

export function ComercialDashboard({
  clienteId,
  ano,
  mes,
  selecaoVendedor, // "macro" | user_id | "manual"
}: {
  clienteId: string;
  ano: number;
  mes: number;
  selecaoVendedor: string;
}) {
  const [registros, setRegistros] = useState<VendedorRegistro[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fimDate = new Date(ano, mes, 0);
      const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

      const [{ data: regs }, { data: profs }] = await Promise.all([
        supabase
          .from("vendedor_registros_diarios")
          .select("*")
          .eq("cliente_id", clienteId)
          .gte("data", inicio)
          .lte("data", fim),
        supabase
          .from("vendedor_profiles")
          .select("user_id, nome")
          .eq("cliente_id", clienteId)
          .eq("ativo", true),
      ]);
      if (cancel) return;
      setRegistros((regs ?? []) as unknown as VendedorRegistro[]);
      setVendedores((profs ?? []) as Vendedor[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [clienteId, ano, mes]);

  const registrosFiltrados = useMemo(() => {
    if (selecaoVendedor === "macro" || selecaoVendedor === "manual") return registros;
    return registros.filter((r) => r.vendedor_user_id === selecaoVendedor);
  }, [registros, selecaoVendedor]);

  const totais = useMemo(() => sumRegistros(registrosFiltrados), [registrosFiltrados]);
  const porDia = useMemo(() => agruparPorDia(registrosFiltrados), [registrosFiltrados]);
  const motivos = useMemo(() => agruparMotivosPerda(registrosFiltrados), [registrosFiltrados]);

  const porVendedor = useMemo(() => {
    return vendedores
      .map((v) => {
        const rs = registros.filter((r) => r.vendedor_user_id === v.user_id);
        return { nome: v.nome, user_id: v.user_id, somado: sumRegistros(rs) };
      })
      .sort((a, b) => b.somado.faturamento_bruto - a.somado.faturamento_bruto);
  }, [vendedores, registros]);

  const semVendedores = vendedores.length === 0;


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-bold uppercase tracking-wide">Dashboard Comercial · alimentado pelos vendedores</h2>
        {loading && <Badge variant="outline" className="ml-auto text-[10px]">carregando…</Badge>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiHero titulo="Faturamento" valor={fmtBRL(totais.faturamento_bruto)} sub={`Ticket ${fmtBRL(totais.ticket_medio)}`} />
        <Kpi titulo="Fechamentos" valor={fmtInt(totais.vendas_fechadas)} sub={`${fmtInt(totais.cotacoes_enviadas)} propostas`} icone={Trophy} cor="amber" />
        <Kpi titulo="Taxa fechamento" valor={`${totais.taxa_fechamento.toFixed(1)}%`} sub={`${fmtInt(totais.vendas_fechadas)}/${fmtInt(totais.cotacoes_enviadas)}`} icone={TrendingUp} cor="emerald" />
        <Kpi titulo="Taxa contato" valor={`${totais.taxa_contato.toFixed(1)}%`} sub={`${fmtInt(totais.contatados_total)}/${fmtInt(totais.leads_recebidos)} leads`} icone={Activity} cor="violet" />
      </div>

      {/* Métricas secundárias */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Mini titulo="Leads recebidos" valor={fmtInt(totais.leads_recebidos)} icone={UsersIcon} />
        <Mini titulo="Contatados ≤2h" valor={fmtInt(totais.contatados_2h)} icone={Clock} />
        <Mini titulo="Contatados >2h" valor={fmtInt(totais.contatados_apos_2h)} icone={Clock} />
        <Mini titulo="Ligações" valor={fmtInt(totais.ligacoes)} icone={Phone} />
        <Mini titulo="Follow-ups" valor={fmtInt(totais.follow_ups)} icone={Repeat} />
        <Mini titulo="Propostas" valor={fmtInt(totais.cotacoes_enviadas)} icone={Send} />
      </div>

      {/* Evolução do mês + Motivos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Evolução do mês</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={porDia.map((d) => ({
                  dia: new Date(d.data + "T00:00:00").getDate(),
                  Leads: d.leads_recebidos,
                  Propostas: d.cotacoes_enviadas,
                  Vendas: d.vendas_fechadas,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Leads" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Propostas" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Vendas" stroke="#10b981" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Principais motivos de perda
            </h3>
            {motivos.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Nenhum motivo registrado no período.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={motivos.slice(0, 6)} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="motivo" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="quantidade" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking dos vendedores do cliente */}
      {porVendedor.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Comparativo entre vendedores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Vendedor</th>
                    <th className="py-2 pr-3">Leads</th>
                    <th className="py-2 pr-3">Propostas</th>
                    <th className="py-2 pr-3">Vendas</th>
                    <th className="py-2 pr-3">Faturamento</th>
                    <th className="py-2 pr-3">Ticket</th>
                    <th className="py-2 pr-3 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {porVendedor.map((v) => (
                    <tr key={v.user_id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{v.nome}</td>
                      <td className="py-2 pr-3">{fmtInt(v.somado.leads_recebidos)}</td>
                      <td className="py-2 pr-3">{fmtInt(v.somado.cotacoes_enviadas)}</td>
                      <td className="py-2 pr-3 font-semibold text-emerald-600">{fmtInt(v.somado.vendas_fechadas)}</td>
                      <td className="py-2 pr-3 font-semibold">{fmtBRL(v.somado.faturamento_bruto)}</td>
                      <td className="py-2 pr-3">{fmtBRL(v.somado.ticket_medio)}</td>
                      <td className="py-2 pr-3 text-right">{v.somado.taxa_fechamento.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiHero({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white shadow-lg shadow-indigo-500/20">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">{titulo}</p>
          <p className="mt-1 text-2xl font-bold">{valor}</p>
          {sub && <p className="mt-0.5 text-[11px] text-white/70">{sub}</p>}
        </div>
        <div className="rounded-lg bg-white/15 p-2"><DollarSign className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, sub, icone: Icon, cor }: {
  titulo: string; valor: string; sub?: string; icone: typeof Trophy;
  cor: "amber" | "emerald" | "violet";
}) {
  const cores = {
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
    violet: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  };
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{titulo}</p>
          <p className="mt-1 text-2xl font-bold">{valor}</p>
          {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${cores[cor]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function Mini({ titulo, valor, icone: Icon }: { titulo: string; valor: string; icone: typeof Phone }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  );
}
