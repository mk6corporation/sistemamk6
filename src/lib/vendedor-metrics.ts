// Helpers para o portal do vendedor — usados pelo painel do vendedor
// e pelas telas internas (dashboard de comercial do cliente).

export type VendedorRegistro = {
  id: string;
  vendedor_user_id: string;
  cliente_id: string;
  data: string;
  leads_recebidos: number;
  contatados_2h: number;
  contatados_apos_2h: number;
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
    contatados_2h: 0,
    contatados_apos_2h: 0,
    ligacoes: 0,
    follow_ups: 0,
    cotacoes_enviadas: 0,
    vendas_fechadas: 0,
    faturamento_bruto: 0,
  };
  for (const r of rows) {
    acc.leads_recebidos += Number(r.leads_recebidos) || 0;
    acc.contatados_2h += Number(r.contatados_2h) || 0;
    acc.contatados_apos_2h += Number(r.contatados_apos_2h) || 0;
    acc.ligacoes += Number(r.ligacoes) || 0;
    acc.follow_ups += Number(r.follow_ups) || 0;
    acc.cotacoes_enviadas += Number(r.cotacoes_enviadas) || 0;
    acc.vendas_fechadas += Number(r.vendas_fechadas) || 0;
    acc.faturamento_bruto += Number(r.faturamento_bruto) || 0;
  }
  const ticket = acc.vendas_fechadas > 0 ? acc.faturamento_bruto / acc.vendas_fechadas : 0;
  const taxa_fechamento = acc.cotacoes_enviadas > 0 ? (acc.vendas_fechadas / acc.cotacoes_enviadas) * 100 : 0;
  const contatados = acc.contatados_2h + acc.contatados_apos_2h;
  const taxa_contato = acc.leads_recebidos > 0 ? (contatados / acc.leads_recebidos) * 100 : 0;
  const taxa_contato_2h = acc.leads_recebidos > 0 ? (acc.contatados_2h / acc.leads_recebidos) * 100 : 0;
  return {
    ...acc,
    contatados_total: contatados,
    ticket_medio: ticket,
    taxa_conversao: taxa_fechamento,
    taxa_fechamento,
    taxa_contato,
    taxa_contato_2h,
  };
}

export type RegistroSomado = ReturnType<typeof sumRegistros>;

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

export function agruparPorDia(rows: VendedorRegistro[]) {
  const map = new Map<string, VendedorRegistro[]>();
  for (const r of rows) {
    const arr = map.get(r.data) ?? [];
    arr.push(r);
    map.set(r.data, arr);
  }
  return Array.from(map.entries())
    .map(([data, rs]) => ({ data, ...sumRegistros(rs) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

const DIAS_SEMANA_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function evolucaoSemana(rows: VendedorRegistro[], base = new Date()) {
  // segunda → domingo da semana corrente
  const ref = new Date(base);
  const dow = ref.getDay(); // 0=dom
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);

  const dias: Array<{ data: string; label: string; somado: RegistroSomado }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toISODate(d);
    const rs = rows.filter((r) => r.data === iso);
    dias.push({
      data: iso,
      label: DIAS_SEMANA_PT[d.getDay()],
      somado: sumRegistros(rs),
    });
  }
  return dias;
}
