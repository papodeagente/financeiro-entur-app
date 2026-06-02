import { addMonths, startOfDay } from "./dates";

export type PeriodKind = "mes" | "trimestre" | "ano";
export type Period = { kind: PeriodKind; year: number; month?: number; quarter?: number; start: Date; end: Date; label: string };

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function currentPeriod(kind: PeriodKind = "mes", ref: Date = new Date()): Period {
  if (kind === "ano") return ofYear(ref.getFullYear());
  if (kind === "trimestre") return ofQuarter(ref.getFullYear(), Math.floor(ref.getMonth() / 3) + 1);
  return ofMonth(ref.getFullYear(), ref.getMonth() + 1);
}

export function ofMonth(year: number, month: number): Period {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { kind: "mes", year, month, start, end, label: `${meses[month - 1]} ${year}` };
}

export function ofQuarter(year: number, quarter: number): Period {
  const m = (quarter - 1) * 3;
  const start = new Date(year, m, 1);
  const end = new Date(year, m + 3, 1);
  return { kind: "trimestre", year, quarter, start, end, label: `${quarter}º trim ${year}` };
}

export function ofYear(year: number): Period {
  return { kind: "ano", year, start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), label: `${year}` };
}

export function previousPeriod(p: Period): Period {
  if (p.kind === "ano") return ofYear(p.year - 1);
  if (p.kind === "trimestre") {
    const q = (p.quarter ?? 1) - 1;
    if (q < 1) return ofQuarter(p.year - 1, 4);
    return ofQuarter(p.year, q);
  }
  const m = (p.month ?? 1) - 1;
  if (m < 1) return ofMonth(p.year - 1, 12);
  return ofMonth(p.year, m);
}

export function lastNMonths(n: number, ref: Date = new Date()): Period[] {
  const out: Period[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push(ofMonth(d.getFullYear(), d.getMonth() + 1));
  }
  return out;
}

export function nextNMonths(n: number, ref: Date = new Date()): Period[] {
  const out: Period[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() + i, 1);
    out.push(ofMonth(d.getFullYear(), d.getMonth() + 1));
  }
  return out;
}

export function periodFromSearch(q?: { year?: string; month?: string; quarter?: string; kind?: string }): Period {
  const kind = (q?.kind as PeriodKind) ?? "mes";
  const now = new Date();
  const year = q?.year ? parseInt(q.year, 10) : now.getFullYear();
  if (kind === "ano") return ofYear(year);
  if (kind === "trimestre") return ofQuarter(year, q?.quarter ? parseInt(q.quarter, 10) : Math.floor(now.getMonth() / 3) + 1);
  return ofMonth(year, q?.month ? parseInt(q.month, 10) : now.getMonth() + 1);
}

export const monthShortLabel = (m: number) => meses[m - 1];

// Helpers reexport
export { addMonths, startOfDay };
