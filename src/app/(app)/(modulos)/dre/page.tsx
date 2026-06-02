import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { brl, pct } from "@/lib/format";
import { periodFromSearch, previousPeriod, type Period } from "@/lib/period";
import { PeriodFilter } from "./_components/period-filter";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

type DRELine = { label: string; value: number; kind?: "header" | "subtract" | "subtotal" | "total"; muted?: boolean };

async function loadDRE(p: Period) {
  const [sales, refunds, chargebacks, expByCategory, taxes] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { grossAmount: true, feeAmount: true },
      where: { saleDate: { gte: p.start, lt: p.end }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    }),
    prisma.refund.aggregate({ _sum: { amount: true }, where: { processedAt: { gte: p.start, lt: p.end } } }),
    prisma.chargeback.aggregate({ _sum: { amount: true }, where: { disputedAt: { gte: p.start, lt: p.end } } }),
    prisma.expense.groupBy({
      by: ["categoryId"], _sum: { amount: true },
      where: { competenceDate: { gte: p.start, lt: p.end }, deletedAt: null, status: { not: "CANCELADO" } },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { competenceDate: { gte: p.start, lt: p.end }, deletedAt: null, status: { not: "CANCELADO" }, category: { name: "Impostos" } },
    }),
  ]);

  const categoryIds = expByCategory.map((e) => e.categoryId).filter((x): x is string => x !== null);
  const cats = categoryIds.length ? await prisma.financialCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [];
  const catName = (id: string | null) => id ? cats.find((c) => c.id === id)?.name ?? "Sem categoria" : "Sem categoria";

  const grossRevenue = num(sales._sum.grossAmount);
  const fees = num(sales._sum.feeAmount);
  const ref = num(refunds._sum.amount);
  const chg = num(chargebacks._sum.amount);
  const netRevenue = grossRevenue - ref - chg - fees;

  const tax = num(taxes._sum.amount);
  const otherCats = expByCategory
    .filter((e) => catName(e.categoryId) !== "Impostos")
    .map((e) => ({ name: catName(e.categoryId), value: num(e._sum.amount) }));
  const totalOpExpenses = otherCats.reduce((a, c) => a + c.value, 0);
  const operatingResult = netRevenue - totalOpExpenses;
  const netResult = operatingResult - tax;

  return { grossRevenue, fees, refunds: ref, chargebacks: chg, netRevenue, otherCats, totalOpExpenses, operatingResult, tax, netResult };
}

function variation(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; quarter?: string; kind?: string }> }) {
  const sp = await searchParams;
  const period = periodFromSearch(sp);
  const previous = previousPeriod(period);

  const [curr, prev] = await Promise.all([loadDRE(period), loadDRE(previous)]);

  function compare(c: number, p: number) {
    const v = variation(c, p);
    if (v === null) return <span className="text-ink-subtle">—</span>;
    const positive = v >= 0;
    return (
      <span className={"text-xs " + (positive ? "text-ok" : "text-danger")}>
        {positive ? "▲" : "▼"} {pct(Math.abs(v))}
      </span>
    );
  }

  const expenseRows = curr.otherCats.map((c) => {
    const prevCat = prev.otherCats.find((x) => x.name === c.name);
    return { name: c.name, current: c.value, previous: prevCat?.value ?? 0 };
  });
  // Categorias só presentes no período anterior
  for (const pCat of prev.otherCats) {
    if (!expenseRows.find((r) => r.name === pCat.name)) {
      expenseRows.push({ name: pCat.name, current: 0, previous: pCat.value });
    }
  }
  expenseRows.sort((a, b) => b.current - a.current);

  return (
    <PageShell
      title="DRE gerencial"
      description={`Demonstrativo de resultados — ${period.label} · regime de competência. Comparação automática com ${previous.label}.`}
      actions={
        <PeriodFilter
          kind={period.kind}
          year={period.year}
          month={period.month ?? new Date().getMonth() + 1}
          quarter={period.quarter ?? 1}
        />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Hero label="Receita líquida" value={curr.netRevenue} prev={prev.netRevenue} good />
        <Hero label="Resultado operacional" value={curr.operatingResult} prev={prev.operatingResult} good />
        <Hero label="Lucro / Prejuízo líquido" value={curr.netResult} prev={prev.netResult} good />
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">DRE detalhado · {period.label}</h3>
          <p className="text-xs text-ink-subtle">vs {previous.label}</p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Linha</th>
              <th className="text-right">{period.label}</th>
              <th className="text-right">{previous.label}</th>
              <th className="text-right">Variação</th>
            </tr>
          </thead>
          <tbody>
            <Section label="Receita Bruta" current={curr.grossRevenue} previous={prev.grossRevenue} compare={compare} />
            <Subtract label="Reembolsos" current={curr.refunds} previous={prev.refunds} compare={compare} />
            <Subtract label="Chargebacks" current={curr.chargebacks} previous={prev.chargebacks} compare={compare} />
            <Subtract label="Taxas de pagamento (plataforma/gateway)" current={curr.fees} previous={prev.fees} compare={compare} />
            <Subtotal label="= Receita Líquida" current={curr.netRevenue} previous={prev.netRevenue} compare={compare} />

            {expenseRows.length > 0 && <RowHeader label="Despesas operacionais (por categoria)" />}
            {expenseRows.map((c) => (
              <Subtract key={c.name} label={c.name} current={c.current} previous={c.previous} compare={compare} />
            ))}
            <Subtotal label="= Resultado Operacional" current={curr.operatingResult} previous={prev.operatingResult} compare={compare} />

            <Subtract label="Impostos" current={curr.tax} previous={prev.tax} compare={compare} />
            <Total label="Lucro / Prejuízo Líquido" current={curr.netResult} previous={prev.netResult} compare={compare} />
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-subtle">
        ⓘ Receita por <strong>data da venda</strong>. Reembolsos por <strong>data do processamento</strong>. Despesas pelo campo <strong>data de competência</strong>.
        Comissões pagas aparecem dentro da respectiva categoria de despesa quando registradas como despesa (próxima fase: lançamento automático).
      </p>
    </PageShell>
  );
}

function Hero({ label, value, prev, good }: { label: string; value: number; prev: number; good?: boolean }) {
  const v = prev === 0 ? null : ((value - prev) / Math.abs(prev)) * 100;
  const tone = value >= 0 ? "text-ok" : "text-danger";
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${good ? tone : "text-ink"}`}>{brl(value)}</p>
      {v !== null && (
        <p className="mt-1 text-xs flex items-center gap-1">
          {v >= 0 ? <ArrowUpRight className="h-3 w-3 text-ok" /> : <ArrowDownRight className="h-3 w-3 text-danger" />}
          <span className={v >= 0 ? "text-ok" : "text-danger"}>{pct(Math.abs(v))}</span>
          <span className="text-ink-subtle">vs período anterior</span>
        </p>
      )}
    </div>
  );
}

function Section({ label, current, previous, compare }: { label: string; current: number; previous: number; compare: (c: number, p: number) => React.ReactNode }) {
  return (
    <tr>
      <td className="font-medium text-ink">{label}</td>
      <td className="text-right font-medium text-ink">{brl(current)}</td>
      <td className="text-right text-ink-muted">{brl(previous)}</td>
      <td className="text-right">{compare(current, previous)}</td>
    </tr>
  );
}
function Subtract({ label, current, previous, compare }: { label: string; current: number; previous: number; compare: (c: number, p: number) => React.ReactNode }) {
  return (
    <tr>
      <td className="text-ink-muted pl-6">(−) {label}</td>
      <td className="text-right text-warn">{brl(current)}</td>
      <td className="text-right text-ink-muted">{brl(previous)}</td>
      <td className="text-right">{compare(current, previous)}</td>
    </tr>
  );
}
function Subtotal({ label, current, previous, compare }: { label: string; current: number; previous: number; compare: (c: number, p: number) => React.ReactNode }) {
  const tone = current >= 0 ? "text-ok" : "text-danger";
  return (
    <tr className="bg-bg-elev/50">
      <td className="font-semibold text-ink">{label}</td>
      <td className={"text-right font-semibold " + tone}>{brl(current)}</td>
      <td className="text-right text-ink-muted">{brl(previous)}</td>
      <td className="text-right">{compare(current, previous)}</td>
    </tr>
  );
}
function Total({ label, current, previous, compare }: { label: string; current: number; previous: number; compare: (c: number, p: number) => React.ReactNode }) {
  const tone = current >= 0 ? "text-ok" : "text-danger";
  return (
    <tr className="bg-brand-soft/30 border-t-2 border-brand-500/30">
      <td className="font-bold text-ink text-base">= {label}</td>
      <td className={"text-right font-bold text-lg " + tone}>{brl(current)}</td>
      <td className="text-right text-ink-muted">{brl(previous)}</td>
      <td className="text-right">{compare(current, previous)}</td>
    </tr>
  );
}
function RowHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={4} className="text-[10px] uppercase tracking-widest text-ink-subtle font-semibold pt-4">{label}</td>
    </tr>
  );
}
