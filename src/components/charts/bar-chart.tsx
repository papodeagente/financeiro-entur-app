import { brl } from "@/lib/format";

export type BarRow = { label: string; value: number; sub?: string };

export function HBarChart({ rows, color = "#A04CFF", formatValue = brl, maxRows = 8 }: {
  rows: BarRow[]; color?: string; formatValue?: (n: number) => string; maxRows?: number;
}) {
  if (!rows.length) return <div className="text-sm text-ink-subtle">Sem dados.</div>;
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, maxRows);
  const max = Math.max(1, ...sorted.map((r) => r.value));
  return (
    <div className="space-y-2">
      {sorted.map((r) => {
        const pct = (r.value / max) * 100;
        return (
          <div key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink truncate pr-2">{r.label}</span>
                <span className="text-ink-muted">{formatValue(r.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-bg-elev overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, #FF1AB5)` }}
                />
              </div>
              {r.sub && <div className="mt-0.5 text-[10px] text-ink-subtle">{r.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StackedBar({ values, labels, colors }: { values: number[]; labels: string[]; colors: string[] }) {
  const total = values.reduce((a, v) => a + v, 0) || 1;
  return (
    <div>
      <div className="h-3 rounded-full overflow-hidden flex bg-bg-elev">
        {values.map((v, i) => (
          <div
            key={i}
            title={`${labels[i]}: ${brl(v)}`}
            style={{ width: `${(v / total) * 100}%`, background: colors[i] }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {labels.map((l, i) => (
          <div key={l} className="flex items-center gap-1.5 text-ink-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: colors[i] }} />
            <span>{l}</span>
            <span className="text-ink-subtle">{brl(values[i])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
