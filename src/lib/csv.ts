export type CsvColumn<T> = { key: string; header: string; render: (row: T) => string | number | null | undefined };

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], options?: { delimiter?: "," | ";"; bom?: boolean }): string {
  const sep = options?.delimiter ?? ";";
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsv(c.header)).join(sep));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsv(c.render(row))).join(sep));
  }
  const content = lines.join("\r\n");
  return options?.bom !== false ? "﻿" + content : content;
}

export function csvResponse(filename: string, content: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function formatBrl(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "0,00";
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (!Number.isFinite(num)) return "0,00";
  return num.toFixed(2).replace(".", ",");
}

export function formatDateBR(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}
