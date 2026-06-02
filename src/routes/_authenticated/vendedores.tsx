import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Trophy, TrendingUp, Users } from "lucide-react";
import { fmtBRL, fmtInt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendedores")({
  component: VendedoresGlobalPage,
});

type Periodo = "mes" | "semana" | "30d";

type LinhaRanking = {
  user_id: string;
  nome: string;
  cliente_id: string;
  cliente_nome: string;
  leads: number;
  cotacoes: number;
  vendas: number;
  faturamento: number;
};

function rangeFor(p: Periodo) {
  const hoje = new Date();
  const end = hoje.toISOString().slice(0, 10);
  if (p === "semana") {
    const d = new Date(hoje); d.setDate(d.getDate() - 6);
    return { start: d.toISOString().slice(0, 10), end };
  }
  if (p === "30d") {
    const d = new Date(hoje); d.setDate(d.getDate() - 29);
    return { start: d.toISOString().slice(0, 10), end };
  }
  return {
    start: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`,
    end,
  };
}

function VendedoresGlobalPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<LinhaRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { start, end } = rangeFor(periodo);
      const { data: profs } = await supabase
        .from("vendedor_profiles")
        .select("user_id, nome, cliente_id");
      const { data: regs } = await supabase
        .from("vendedor_registros_diarios")
        .select("vendedor_user_id, cliente_id, leads_recebidos, cotacoes_enviadas, vendas_fechadas, faturamento_bruto")
        .gte("data", start)
        .lte("data", end);
      const { data: cls } = await supabase.from("clientes").select("id, nome");

      const clientesMap = new Map((cls ?? []).map((c) => [c.id, c.nome]));
      const map = new Map<string, LinhaRanking>();
      for (const p of profs ?? []) {
        const k = `${p.user_id}__${p.cliente_id}`;
        map.set(k, {
          user_id: p.user_id,
          nome: p.nome,
          cliente_id: p.cliente_id,
          cliente_nome: clientesMap.get(p.cliente_id) ?? "—",
          leads: 0, cotacoes: 0, vendas: 0, faturamento: 0,
        });
      }
      for (const r of regs ?? []) {
        const k = `${r.vendedor_user_id}__${r.cliente_id}`;
        const cur = map.get(k);
        if (!cur) continue;
        cur.leads += Number(r.leads_recebidos) || 0;
        cur.cotacoes += Number(r.cotacoes_enviadas) || 0;
        cur.vendas += Number(r.vendas_fechadas) || 0;
        cur.faturamento += Number(r.faturamento_bruto) || 0;
      }
      if (!cancel) {
        setLinhas(Array.from(map.values()).sort((a, b) => b.faturamento - a.faturamento));
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [periodo]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) => l.nome.toLowerCase().includes(q) || l.cliente_nome.toLowerCase().includes(q));
  }, [linhas, busca]);

  const totais = useMemo(() => {
    return filtradas.reduce(
      (acc, l) => {
        acc.leads += l.leads;
        acc.vendas += l.vendas;
        acc.faturamento += l.faturamento;
        return acc;
      },
      { leads: 0, vendas: 0, faturamento: 0 },
    );
  }, [filtradas]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Vendedores</h1>
        <p className="text-sm text-muted-foreground">Ranking de vendedores de todos os clientes</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Vendedores" value={fmtInt(new Set(filtradas.map((l) => l.user_id)).size)} />
        <KpiCard icon={<Trophy className="h-4 w-4" />} label="Vendas no período" value={fmtInt(totais.vendas)} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Faturamento" value={fmtBRL(totais.faturamento)} highlight />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Ranking</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar vendedor ou cliente"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-64 pl-8"
              />
            </div>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="mes">Mês atual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum vendedor encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Cotações</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l, i) => (
                  <TableRow key={`${l.user_id}-${l.cliente_id}`}>
                    <TableCell>
                      {i === 0 ? <Badge className="bg-amber-500">🥇</Badge> :
                       i === 1 ? <Badge className="bg-slate-400">🥈</Badge> :
                       i === 2 ? <Badge className="bg-orange-400">🥉</Badge> :
                       <span className="text-xs text-muted-foreground">{i + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell>
                      <Link to="/clientes/$clienteId" params={{ clienteId: l.cliente_id }} className="text-primary hover:underline">
                        {l.cliente_nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(l.leads)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(l.cotacoes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(l.vendas)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(l.faturamento)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/30 bg-gradient-to-br from-primary/5 to-blue-500/5" : ""}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
