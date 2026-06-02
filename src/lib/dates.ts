export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function todayISODate(): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}

export function parseDateInput(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function daysOverdue(dueDate: Date | string, ref: Date = new Date()): number {
  const due = startOfDay(new Date(dueDate));
  const r = startOfDay(ref);
  return Math.max(0, Math.floor((r.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

export type DelinquencyBucket = "1-7" | "8-15" | "16-30" | "31-60" | "61-90" | "90+";
export function bucketOf(days: number): DelinquencyBucket | null {
  if (days < 1) return null;
  if (days <= 7) return "1-7";
  if (days <= 15) return "8-15";
  if (days <= 30) return "16-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
