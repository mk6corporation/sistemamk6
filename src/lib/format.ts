// Formatadores padrão do sistema (pt-BR)

export function fmtBRL(v: number | null | undefined, opts?: { semDecimais?: boolean }) {
  if (v == null || !isFinite(v as number)) return "—";
  const digits = opts?.semDecimais ? 0 : 2;
  return Number(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(v: number | null | undefined, decimais = 0) {
  if (v == null || !isFinite(v as number)) return "—";
  return `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: decimais, maximumFractionDigits: decimais })}%`;
}

export function fmtInt(v: number | null | undefined) {
  if (v == null || !isFinite(v as number)) return "—";
  return Math.round(Number(v)).toLocaleString("pt-BR");
}
