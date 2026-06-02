"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function PeriodFilter({ kind, year, month, quarter }: { kind: string; year: number; month: number; quarter: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(Array.from(params.entries()));
    Object.entries(next).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k));
    router.replace(`${pathname}?${p.toString()}`);
  }

  const years = [year - 2, year - 1, year, year + 1];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-auto" value={kind} onChange={(e) => update({ kind: e.target.value })}>
        <option value="mes">Mês</option>
        <option value="trimestre">Trimestre</option>
        <option value="ano">Ano</option>
      </select>
      {kind === "mes" && (
        <select className="input w-auto" value={month} onChange={(e) => update({ month: e.target.value })}>
          {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      )}
      {kind === "trimestre" && (
        <select className="input w-auto" value={quarter} onChange={(e) => update({ quarter: e.target.value })}>
          {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}º trimestre</option>)}
        </select>
      )}
      <select className="input w-auto" value={year} onChange={(e) => update({ year: e.target.value })}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
