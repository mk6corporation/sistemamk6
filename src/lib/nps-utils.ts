export type NpsResposta = {
  id: string;
  cliente_id: string;
  score: number;
  comentario: string | null;
  respondido_em: string;
  source: string | null;
  source_id: string | null;
};

export type NpsLink = {
  id: string;
  slug: string;
  produto: string;
  titulo: string | null;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export function classifyNps(score: number): "promotor" | "neutro" | "detrator" {
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

export function calcNps(scores: number[]): {
  total: number;
  promotores: number;
  neutros: number;
  detratores: number;
  nps: number;
  media: number;
} {
  const total = scores.length;
  if (total === 0)
    return { total: 0, promotores: 0, neutros: 0, detratores: 0, nps: 0, media: 0 };
  let p = 0,
    n = 0,
    d = 0,
    sum = 0;
  for (const s of scores) {
    sum += s;
    const c = classifyNps(s);
    if (c === "promotor") p++;
    else if (c === "neutro") n++;
    else d++;
  }
  const nps = Math.round(((p - d) / total) * 100);
  return { total, promotores: p, neutros: n, detratores: d, nps, media: sum / total };
}

export function scoreBadgeClasses(score: number) {
  const c = classifyNps(score);
  if (c === "promotor") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (c === "neutro") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-red-500/15 text-red-700 border-red-500/30";
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
