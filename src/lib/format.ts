import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function brl(value: number | string | { toString: () => string } | null | undefined) {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : parseFloat(value.toString());
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function pct(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

export function dateBR(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
}

export function dateTimeBR(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function relTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return formatDistanceToNowStrict(new Date(d), { locale: ptBR, addSuffix: true });
}

export function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function daysOverdue(dueDate: Date | string, ref: Date = new Date()) {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const r = new Date(ref);
  r.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((r.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}
