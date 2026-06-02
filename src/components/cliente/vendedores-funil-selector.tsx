import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw, UserCog, BarChart2 } from "lucide-react";
import { fmtBRL, fmtInt } from "@/lib/format";

export type VendedorAgregado = {
  leads: number;
  cotacoes: number;
  vendas: number;
  faturamentoBruto: number;
  ligacoes: number;
  follow_ups: number;
};

export type VendedorRow = {
  user_id: string;
  nome: string;
  agg: VendedorAgregado;
};

export type SelectionMode = "manual" | "macro" | string; // string = user_id

export function VendedoresFunilSelector({
  clienteId,
  ano,
  mes,
  mode,
  onChange,
  compact = false,
}: {
  clienteId: string;
  ano: number;
  mes: number;
  mode: SelectionMode;
  onChange: (mode: SelectionMode, agg: VendedorAgregado | null, vendedoresCount: number) => void;
  compact?: boolean;
}) {
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [macro, setMacro] = useState<VendedorAgregado | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase
      .from("vendedor_profiles")
      .select("user_id, nome")
      .eq("cliente_id", clienteId)
      .eq("ativo", true);

    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimDate = new Date(ano, mes, 0);
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

    const { data: regs } = await supabase
      .from("vendedor_registros_diarios")
      .select("vendedor_user_id, leads_recebidos, ligacoes, follow_ups, cotacoes_enviadas, vendas_fechadas, faturamento_bruto")
      .eq("cliente_id", clienteId)
      .gte("data", inicio)
      .lte("data", fim);

    const map = new Map<string, VendedorAgregado>();
    const macroAcc: VendedorAgregado = { leads: 0, cotacoes: 0, vendas: 0, faturamentoBruto: 0, ligacoes: 0, follow_ups: 0 };
    for (const r of regs ?? []) {
      const cur = map.get(r.vendedor_user_id) ?? { leads: 0, cotacoes: 0, vendas: 0, faturamentoBruto: 0, ligacoes: 0, follow_ups: 0 };
      cur.leads += Number(r.leads_recebidos) || 0;
      cur.cotacoes += Number(r.cotacoes_enviadas) || 0;
      cur.vendas += Number(r.vendas_fechadas) || 0;
      cur.faturamentoBruto += Number(r.faturamento_bruto) || 0;
      cur.ligacoes += Number(r.ligacoes) || 0;
      cur.follow_ups += Number(r.follow_ups) || 0;
      map.set(r.vendedor_user_id, cur);

      macroAcc.leads += Number(r.leads_recebidos) || 0;
      macroAcc.cotacoes += Number(r.cotacoes_enviadas) || 0;
      macroAcc.vendas += Number(r.vendas_fechadas) || 0;
      macroAcc.faturamentoBruto += Number(r.faturamento_bruto) || 0;
      macroAcc.ligacoes += Number(r.ligacoes) || 0;
      macroAcc.follow_ups += Number(r.follow_ups) || 0;
    }

    const rows: VendedorRow[] = (profs ?? []).map((p) => ({
      user_id: p.user_id,
      nome: p.nome,
      agg: map.get(p.user_id) ?? { leads: 0, cotacoes: 0, vendas: 0, faturamentoBruto: 0, ligacoes: 0, follow_ups: 0 },
    }));

    setVendedores(rows);
    setMacro(rows.length > 0 ? macroAcc : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, ano, mes]);

  // Reporta mudanças
  useEffect(() => {
    if (mode === "manual" || !macro) {
      onChange(mode, null, vendedores.length);
      return;
    }
    if (mode === "macro") {
      onChange("macro", macro, vendedores.length);
      return;
    }
    const v = vendedores.find((x) => x.user_id === mode);
    onChange(mode, v ? v.agg : null, vendedores.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, vendedores, macro]);

  const top = useMemo(
    () => [...vendedores].sort((a, b) => b.agg.faturamentoBruto - a.agg.faturamentoBruto),
    [vendedores],
  );

  if (vendedores.length === 0 && !loading) {
    if (compact) {
      return (
        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" /> Sem vendedores · manual
        </Badge>
      );
    }
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Nenhum vendedor cadastrado para este cliente. Preenchimento manual ativo.
        </div>
      </div>
    );
  }


  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Users className="h-3 w-3" /> {vendedores.length}
        </Badge>
        <Button
          size="sm"
          variant={mode === "macro" ? "default" : "outline"}
          className="h-8 gap-1 text-xs"
          onClick={() => onChange("macro", macro, vendedores.length)}
        >
          <BarChart2 className="h-3 w-3" /> Macro
        </Button>
        {top.map((v) => (
          <Button
            key={v.user_id}
            size="sm"
            variant={mode === v.user_id ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => onChange(v.user_id, v.agg, vendedores.length)}
          >
            {v.nome.split(" ")[0]}
          </Button>
        ))}
        <Button
          size="sm"
          variant={mode === "manual" ? "default" : "ghost"}
          className="h-8 gap-1 text-xs"
          onClick={() => onChange("manual", null, vendedores.length)}
        >
          <UserCog className="h-3 w-3" /> Manual
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-gradient-to-br from-indigo-500/5 to-blue-500/5 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" /> {vendedores.length} vendedor(es)
        </Badge>
        <span className="text-xs text-muted-foreground">Visão do Realizado:</span>

        <Button
          size="sm"
          variant={mode === "macro" ? "default" : "outline"}
          className="h-7 gap-1"
          onClick={() => onChange("macro", macro, vendedores.length)}
        >
          <BarChart2 className="h-3 w-3" /> Macro (todos)
        </Button>

        {top.map((v) => (
          <Button
            key={v.user_id}
            size="sm"
            variant={mode === v.user_id ? "default" : "outline"}
            className="h-7"
            onClick={() => onChange(v.user_id, v.agg, vendedores.length)}
          >
            {v.nome.split(" ")[0]}
          </Button>
        ))}

        <Button
          size="sm"
          variant={mode === "manual" ? "default" : "ghost"}
          className="h-7 gap-1"
          onClick={() => onChange("manual", null, vendedores.length)}
        >
          <UserCog className="h-3 w-3" /> Manual
        </Button>

        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Comparativo */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ComparativoCard
          ativo={mode === "macro"}
          titulo="Macro (todos)"
          subtitulo="Soma do mês"
          agg={macro ?? { leads: 0, cotacoes: 0, vendas: 0, faturamentoBruto: 0, ligacoes: 0, follow_ups: 0 }}
        />
        {top.slice(0, 3).map((v) => (
          <ComparativoCard
            key={v.user_id}
            ativo={mode === v.user_id}
            titulo={v.nome}
            subtitulo="Vendedor"
            agg={v.agg}
          />
        ))}
      </div>
    </div>
  );
}

function ComparativoCard({
  ativo,
  titulo,
  subtitulo,
  agg,
}: {
  ativo: boolean;
  titulo: string;
  subtitulo: string;
  agg: VendedorAgregado;
}) {
  const conv = agg.cotacoes > 0 ? (agg.vendas / agg.cotacoes) * 100 : 0;
  return (
    <div
      className={`rounded-md border p-2 transition ${
        ativo ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-xs font-semibold">{titulo}</span>
        <span className="text-[10px] text-muted-foreground">{subtitulo}</span>
      </div>
      <div className="mt-1 text-sm font-bold">{fmtBRL(agg.faturamentoBruto)}</div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        <span>Leads: <strong className="text-foreground">{fmtInt(agg.leads)}</strong></span>
        <span>Vendas: <strong className="text-foreground">{fmtInt(agg.vendas)}</strong></span>
        <span>Conv: <strong className="text-foreground">{conv.toFixed(1)}%</strong></span>
      </div>
    </div>
  );
}
