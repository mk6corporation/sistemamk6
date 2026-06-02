import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Link2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtInt } from "@/lib/format";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function VendedoresClienteTab({ clienteId, clienteNome }: { clienteId: string; clienteNome: string }) {
  const [link, setLink] = useState<{ id: string; slug: string; ativo: boolean } | null>(null);
  const [vendedores, setVendedores] = useState<
    Array<{ user_id: string; nome: string; email: string | null; ativo: boolean; ultimo_acesso: string | null }>
  >([]);
  const [metricasMes, setMetricasMes] = useState<Record<string, { leads: number; vendas: number; faturamento: number; cotacoes: number }>>({});
  const [loading, setLoading] = useState(true);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = link ? `${baseUrl}/v/${link.slug}` : "";

  const load = async () => {
    setLoading(true);
    const { data: linkRow } = await supabase
      .from("vendedor_links")
      .select("id, slug, ativo")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    setLink(linkRow ?? null);

    const { data: profs } = await supabase
      .from("vendedor_profiles")
      .select("user_id, nome, email, ativo, ultimo_acesso")
      .eq("cliente_id", clienteId)
      .order("nome");
    setVendedores(profs ?? []);

    // Métricas do mês corrente
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimDate = new Date(ano, mes, 0);
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

    const { data: regs } = await supabase
      .from("vendedor_registros_diarios")
      .select("vendedor_user_id, leads_recebidos, cotacoes_enviadas, vendas_fechadas, faturamento_bruto")
      .eq("cliente_id", clienteId)
      .gte("data", inicio)
      .lte("data", fim);

    const m: Record<string, { leads: number; vendas: number; faturamento: number; cotacoes: number }> = {};
    for (const r of regs ?? []) {
      const cur = m[r.vendedor_user_id] ?? { leads: 0, vendas: 0, faturamento: 0, cotacoes: 0 };
      cur.leads += Number(r.leads_recebidos) || 0;
      cur.cotacoes += Number(r.cotacoes_enviadas) || 0;
      cur.vendas += Number(r.vendas_fechadas) || 0;
      cur.faturamento += Number(r.faturamento_bruto) || 0;
      m[r.vendedor_user_id] = cur;
    }
    setMetricasMes(m);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const gerarLink = async () => {
    const base = slugify(clienteNome) || "cliente";
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await supabase
      .from("vendedor_links")
      .insert({ cliente_id: clienteId, slug, titulo: `Cadastro de vendedores · ${clienteNome}` });
    if (error) return toast.error("Erro ao gerar link: " + error.message);
    toast.success("Link gerado!");
    load();
  };

  const toggleAtivo = async (ativo: boolean) => {
    if (!link) return;
    const { error } = await supabase.from("vendedor_links").update({ ativo }).eq("id", link.id);
    if (error) return toast.error(error.message);
    setLink({ ...link, ativo });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const ranking = useMemo(
    () =>
      [...vendedores].sort((a, b) => (metricasMes[b.user_id]?.faturamento ?? 0) - (metricasMes[a.user_id]?.faturamento ?? 0)),
    [vendedores, metricasMes],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-5 w-5" /> Link de cadastro
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Envie este link aos vendedores deste cliente. Cada um cria seu próprio login e passa a registrar dados diariamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!link ? (
            <Button onClick={gerarLink} className="gap-2">
              <Link2 className="h-4 w-4" /> Gerar link único do cliente
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input readOnly value={url} className="flex-1 min-w-[280px] font-mono text-xs" />
                <Button variant="outline" onClick={copyUrl} className="gap-2">
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Switch checked={link.ativo} onCheckedChange={toggleAtivo} id="link-ativo" />
                  <Label htmlFor="link-ativo" className="text-xs">{link.ativo ? "Ativo" : "Pausado"}</Label>
                </div>
              </div>
              {!link.ativo && (
                <p className="text-xs text-amber-600">Link pausado — novos vendedores não conseguem se cadastrar.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" /> Vendedores cadastrados ({vendedores.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Ranking do mês atual</p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {vendedores.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum vendedor cadastrado ainda. Compartilhe o link acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Cotações</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((v, i) => {
                  const m = metricasMes[v.user_id] ?? { leads: 0, vendas: 0, faturamento: 0, cotacoes: 0 };
                  return (
                    <TableRow key={v.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {i === 0 && m.faturamento > 0 && <Badge className="bg-amber-500">#1</Badge>}
                          <div>
                            <div className="font-medium">{v.nome}</div>
                            <div className="text-xs text-muted-foreground">{v.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(m.leads)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(m.cotacoes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(m.vendas)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(m.faturamento)}</TableCell>
                      <TableCell>
                        <Badge variant={v.ativo ? "secondary" : "outline"}>{v.ativo ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
