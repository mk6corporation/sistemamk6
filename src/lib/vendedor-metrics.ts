// Helpers para o portal do vendedor — usados pelo painel do vendedor
// e pelas telas internas de ranking.

export type VendedorRegistro = {
  id: string;
  vendedor_user_id: string;
  cliente_id: string;
  data: string;
  leads_recebidos: number;
  ligacoes: number;
  follow_ups: number;
  cotacoes_enviadas: number;
  vendas_fechadas: number;
  faturamento_bruto: number;
  motivos_perda: Array<{ motivo: string; quantidade: number }>;
  observacoes?: string | null;
};

export type Periodo = "dia" | "semana" | "quinzena" | "mes";

export function rangeFor(periodo: Periodo, base = new Date()) {
  const end = new Date(base);
  const start = new Date(base);
  if (periodo === "dia") {
    // mesmo dia
  } else if (periodo === "semana") {
    start.setDate(start.getDate() - 6);
  } else if (periodo === "quinzena") {
    start.setDate(start.getDate() - 14);
  } else {
    start.setDate(1);
  }
  return { start: toISODate(start), end: toISODate(end) };
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function sumRegistros(rows: VendedorRegistro[]) {
  const acc = {
    leads_recebidos: 0,
    ligacoes: 0,
    follow_ups: 0,
    cotacoes_enviadas: 0,
    vendas_fechadas: 0,
    faturamento_bruto: 0,
  };
  for (const r of rows) {
    acc.leads_recebidos += Number(r.leads_recebidos) || 0;
    acc.ligacoes += Number(r.ligacoes) || 0;
    acc.follow_ups += Number(r.follow_ups) || 0;
    acc.cotacoes_enviadas += Number(r.cotacoes_enviadas) || 0;
    acc.vendas_fechadas += Number(r.vendas_fechadas) || 0;
    acc.faturamento_bruto += Number(r.faturamento_bruto) || 0;
  }
  const ticket = acc.vendas_fechadas > 0 ? acc.faturamento_bruto / acc.vendas_fechadas : 0;
  const conversao = acc.cotacoes_enviadas > 0 ? (acc.vendas_fechadas / acc.cotacoes_enviadas) * 100 : 0;
  return { ...acc, ticket_medio: ticket, taxa_conversao: conversao };
}

export function agruparMotivosPerda(rows: VendedorRegistro[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    for (const m of r.motivos_perda || []) {
      map.set(m.motivo, (map.get(m.motivo) || 0) + (Number(m.quantidade) || 0));
    }
  }
  return Array.from(map.entries())
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}
