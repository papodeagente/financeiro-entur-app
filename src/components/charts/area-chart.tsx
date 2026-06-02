import { brl } from "@/lib/format";

export type AreaPoint = { label: string; value: number };

export function AreaChart({
  data, color = "#A04CFF", height = 160, formatValue = brl,
}: { data: AreaPoint[]; color?: string; height?: number; formatValue?: (n: number) => string }) {
  if (!data.length) return <div className="text-sm text-ink-subtle">Sem dados no período.</div>;
  const width = 600;
  const padding = { l: 0, r: 0, t: 16, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const n = data.length;
  const xStep = (width - padding.l - padding.r) / Math.max(1, n - 1);
  const innerH = height - padding.t - padding.b;

  const pts = data.map((d, i) => {
    const x = padding.l + i * xStep;
    const y = padding.t + innerH - ((d.value - min) / range) * innerH;
    return { x, y, label: d.label, value: d.value };
  });

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${pts[pts.length - 1].x.toFixed(1)},${padding.t + innerH} L${pts[0].x.toFixed(1)},${padding.t + innerH} Z`;

  const gid = `g-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={0} x2={width} y1={padding.t + innerH * t} y2={padding.t + innerH * t} stroke="#2A2256" strokeDasharray="3 4" strokeWidth={0.5} />
      ))}
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={2.5} fill={color} />
          <title>{`${p.label}: ${formatValue(p.value)}`}</title>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={padding.l + i * xStep} y={height - 8} textAnchor="middle" fontSize="10" fill="#7A73AE">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

export function DualAreaChart({
  series, height = 180,
}: { series: { label: string; color: string; data: AreaPoint[] }[]; height?: number }) {
  if (!series.length) return null;
  const width = 600;
  const padding = { l: 0, r: 0, t: 16, b: 28 };
  const allPoints = series.flatMap((s) => s.data.map((d) => d.value));
  const max = Math.max(1, ...allPoints);
  const min = Math.min(0, ...allPoints);
  const range = max - min || 1;
  const n = series[0].data.length;
  const xStep = (width - padding.l - padding.r) / Math.max(1, n - 1);
  const innerH = height - padding.t - padding.b;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={0} x2={width} y1={padding.t + innerH * t} y2={padding.t + innerH * t} stroke="#2A2256" strokeDasharray="3 4" strokeWidth={0.5} />
        ))}
        {series.map((s, si) => {
          const pts = s.data.map((d, i) => ({
            x: padding.l + i * xStep,
            y: padding.t + innerH - ((d.value - min) / range) * innerH,
            label: d.label, value: d.value,
          }));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={2.5} fill={s.color} />
                  <title>{`${s.label} ${p.label}: ${brl(p.value)}`}</title>
                </g>
              ))}
            </g>
          );
        })}
        {series[0].data.map((d, i) => (
          <text key={i} x={padding.l + i * xStep} y={height - 8} textAnchor="middle" fontSize="10" fill="#7A73AE">
            {d.label}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-end gap-4">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
