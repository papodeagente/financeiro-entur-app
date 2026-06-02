import { prisma } from "@/lib/db";
import { brl, pct } from "@/lib/format";
import { PageShell } from "@/components/layout/page-shell";
import { AreaChart, DualAreaChart, type AreaPoint } from "@/components/charts/area-chart";
import { HBarChart, type BarRow } from "@/components/charts/bar-chart";
import { lastNMonths, nextNMonths } from "@/lib/period";
import { syncOverdueInstallments, syncOverdueExpenses } from "@/lib/finance-ops";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Wallet, AlertTriangle, Users, Repeat, Receipt, Percent,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Money = { toNumber: () => number };
const n = (d: Money | null | undefined) => d ? d.toNumber() : 0;
const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

async function loadKpis() {
  await Promise.all([syncOverdueInstallments(), syncOverdueExpenses()]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    salesMonth, refundsMonth, chargebacksMonth, expensesMonth,
    bankBalances, arOpen, apOpen, overdueAmount, allOpen,
    rrm, avgTicket, activeCustomers, delinquentCustomers,
    overdueCount, dueNext30Count, refundsCount, chargebacksCount,
    commissionsToPay,
  ] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { grossAmount: true, netAmount: true, feeAmount: true },
      where: { saleDate: { gte: monthStart, lt: nextMonth }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    }),
    prisma.refund.aggregate({ _sum: { amount: true }, where: { processedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.chargeback.aggregate({ _sum: { amount: true }, where: { disputedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { competenceDate: { gte: monthStart, lt: nextMonth }, deletedAt: null, status: { not: "CANCELADO" } } }),
    prisma.bankAccount.aggregate({ _sum: { currentBalance: true }, where: { active: true, deletedAt: null } }),
    prisma.revenueInstallment.aggregate({
      _sum: { amount: true, paidAmount: true },
      where: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] }, deletedAt: null },
    }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] }, deletedAt: null } }),
    prisma.revenueInstallment.aggregate({ _sum: { amount: true, paidAmount: true }, where: { status: "VENCIDO", deletedAt: null } }),
    prisma.revenueInstallment.aggregate({ _sum: { amount: true }, where: { deletedAt: null, status: { not: "CANCELADO" } } }),
    prisma.subscription.aggregate({ _sum: { amount: true }, where: { status: "ATIVA", deletedAt: null, period: "MENSAL" } }),
    prisma.sale.aggregate({ _avg: { netAmount: true }, where: { saleDate: { gte: monthStart, lt: nextMonth }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } } }),
    prisma.customer.count({ where: { status: "ATIVO", deletedAt: null } }),
    prisma.customer.count({ where: { status: "INADIMPLENTE", deletedAt: null } }),
    prisma.revenueInstallment.count({ where: { status: "VENCIDO", deletedAt: null } }),
    prisma.revenueInstallment.count({
      where: { deletedAt: null, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] },
        dueDate: { gte: now, lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30) } },
    }),
    prisma.refund.count({ where: { processedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.chargeback.count({ where: { disputedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.commission.aggregate({ _sum: { amount: true }, where: { status: "LIBERADA" } }),
  ]);

  const grossRevenue = n(salesMonth._sum.grossAmount as Money | null);
  const refunds = n(refundsMonth._sum.amount as Money | null);
  const chargebacks = n(chargebacksMonth._sum.amount as Money | null);
  const fees = n(salesMonth._sum.feeAmount as Money | null);
  const netRevenue = grossRevenue - refunds - chargebacks - fees;
  const expenses = n(expensesMonth._sum.amount as Money | null);
  const result = netRevenue - expenses;
  const cash = n(bankBalances._sum.currentBalance as Money | null);
  const ar = n(arOpen._sum.amount as Money | null) - n(arOpen._sum.paidAmount as Money | null);
  const ap = n(apOpen._sum.amount as Money | null);
  const overdue = n(overdueAmount._sum.amount as Money | null) - n(overdueAmount._sum.paidAmount as Money | null);
  const overduePct = n(allOpen._sum.amount as Money | null) > 0 ? (overdue / n(allOpen._sum.amount as Money | null)) * 100 : 0;
  const mrr = n(rrm._sum.amount as Money | null);
  const ticket = n(avgTicket._avg.netAmount as Money | null);

  return {
    grossRevenue, netRevenue, expenses, result, cash, ar, ap,
    overdue, overduePct, mrr, ticket,
    activeCustomers, delinquentCustomers, overdueCount, dueNext30Count,
    refunds, refundsCount, chargebacks, chargebacksCount,
    commissionsToPay: n(commissionsToPay._sum.amount as Money | null),
  };
}

async function loadCharts() {
  const months6 = lastNMonths(6);
  const periodStart = months6[0].start;
  const periodEnd = months6[months6.length - 1].end;

  const [sales, fees, refunds, chargebacks, expenses, byProduct, byCategory] = await Promise.all([
    prisma.sale.groupBy({ by: ["saleDate"], _sum: { grossAmount: true }, where: { saleDate: { gte: periodStart, lt: periodEnd }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } } }),
    prisma.sale.groupBy({ by: ["saleDate"], _sum: { feeAmount: true }, where: { saleDate: { gte: periodStart, lt: periodEnd }, deletedAt: null } }),
    prisma.refund.groupBy({ by: ["processedAt"], _sum: { amount: true }, where: { processedAt: { gte: periodStart, lt: periodEnd } } }),
    prisma.chargeback.groupBy({ by: ["disputedAt"], _sum: { amount: true }, where: { disputedAt: { gte: periodStart, lt: periodEnd } } }),
    prisma.expense.groupBy({ by: ["competenceDate"], _sum: { amount: true }, where: { competenceDate: { gte: periodStart, lt: periodEnd }, deletedAt: null, status: { not: "CANCELADO" } } }),
    prisma.sale.groupBy({
      by: ["productId"], _sum: { netAmount: true }, _count: true,
      where: { saleDate: { gte: periodStart, lt: periodEnd }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
      orderBy: { _sum: { netAmount: "desc" } }, take: 8,
    }),
    prisma.expense.groupBy({
      by: ["categoryId"], _sum: { amount: true },
      where: { competenceDate: { gte: periodStart, lt: periodEnd }, deletedAt: null, status: { not: "CANCELADO" } },
      orderBy: { _sum: { amount: "desc" } }, take: 8,
    }),
  ]);

  function bucketize(rows: { date: Date; value: number }[]): AreaPoint[] {
    const map = new Map<string, number>();
    for (const m of months6) map.set(`${m.year}-${m.month}`, 0);
    for (const r of rows) {
      const k = `${r.date.getFullYear()}-${r.date.getMonth() + 1}`;
      map.set(k, (map.get(k) ?? 0) + r.value);
    }
    return months6.map((m) => ({ label: m.label.split(" ")[0], value: map.get(`${m.year}-${m.month}`) ?? 0 }));
  }

  const netByMonth = bucketize([
    ...sales.map((s) => ({ date: s.saleDate, value: num(s._sum.grossAmount) })),
    ...fees.map((f) => ({ date: f.saleDate, value: -num(f._sum.feeAmount) })),
    ...refunds.map((r) => ({ date: r.processedAt, value: -num(r._sum.amount) })),
    ...chargebacks.map((c) => ({ date: c.disputedAt, value: -num(c._sum.amount) })),
  ]);
  const grossByMonth = bucketize(sales.map((s) => ({ date: s.saleDate, value: num(s._sum.grossAmount) })));
  const expensesByMonth = bucketize(expenses.map((e) => ({ date: e.competenceDate, value: num(e._sum.amount) })));

  const productIds = byProduct.map((p) => p.productId);
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [];
  const productByProduct: BarRow[] = byProduct.map((p) => {
    const prod = products.find((x) => x.id === p.productId);
    return { label: prod?.name ?? "?", value: num(p._sum.netAmount), sub: `${p._count} venda${p._count > 1 ? "s" : ""}` };
  });

  const categoryIds = byCategory.map((c) => c.categoryId).filter((id): id is string => id !== null);
  const categories = categoryIds.length ? await prisma.financialCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [];
  const expensesByCategory: BarRow[] = byCategory.map((c) => {
    const cat = c.categoryId ? categories.find((x) => x.id === c.categoryId) : null;
    return { label: cat?.name ?? "Sem categoria", value: num(c._sum.amount) };
  });

  return { netByMonth, grossByMonth, expensesByMonth, productByProduct, expensesByCategory };
}

async function loadCashProjection() {
  const months = nextNMonths(3);
  const out: { month: string; entradas: number; saidas: number; saldo: number }[] = [];
  let saldo = num((await prisma.bankAccount.aggregate({ _sum: { currentBalance: true }, where: { active: true, deletedAt: null } }))._sum.currentBalance);
  for (const m of months) {
    const [arPrev, apPrev] = await Promise.all([
      prisma.revenueInstallment.aggregate({
        _sum: { amount: true, paidAmount: true },
        where: { deletedAt: null, dueDate: { gte: m.start, lt: m.end }, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { deletedAt: null, dueDate: { gte: m.start, lt: m.end }, status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] } },
      }),
    ]);
    const entradas = num(arPrev._sum.amount) - num(arPrev._sum.paidAmount);
    const saidas = num(apPrev._sum.amount);
    saldo = saldo + entradas - saidas;
    out.push({ month: m.label.split(" ")[0], entradas, saidas, saldo });
  }
  return out;
}

export default async function DashboardPage() {
  const [k, charts, projection] = await Promise.all([loadKpis(), loadCharts(), loadCashProjection()]);

  return (
    <PageShell title="Visão executiva" description="Resumo financeiro do mês atual, evolução e projeção de caixa.">
      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Receita bruta (mês)" value={brl(k.grossRevenue)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" />
        <Kpi label="Receita líquida (mês)" value={brl(k.netRevenue)} hint="Bruto − reembolsos − chargebacks − taxas" icon={<ArrowUpRight className="h-4 w-4" />} accent="ok" />
        <Kpi label="Despesas (mês)" value={brl(k.expenses)} icon={<TrendingDown className="h-4 w-4" />} accent="warn" />
        <Kpi label="Resultado (mês)" value={brl(k.result)} hint={k.result >= 0 ? "Lucro" : "Prejuízo"} icon={k.result >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />} accent={k.result >= 0 ? "ok" : "danger"} />
      </div>

      {/* Gráfico evolução */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Evolução · últimos 6 meses</h3>
            <p className="text-xs text-ink-subtle mt-0.5">Receita líquida × despesas por competência.</p>
          </div>
        </div>
        <DualAreaChart
          series={[
            { label: "Receita líquida", color: "#A855F7", data: charts.netByMonth },
            { label: "Despesas", color: "#F59E0B", data: charts.expensesByMonth },
          ]}
        />
      </div>

      {/* KPIs caixa & posições */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Saldo em caixa" value={brl(k.cash)} icon={<Wallet className="h-4 w-4" />} accent="info" />
        <Kpi label="A receber em aberto" value={brl(k.ar)} hint={`${k.dueNext30Count} parcelas vencem em 30d`} icon={<TrendingUp className="h-4 w-4" />} accent="brand" />
        <Kpi label="A pagar em aberto" value={brl(k.ap)} icon={<Receipt className="h-4 w-4" />} accent="warn" />
        <Kpi label="Comissões a pagar" value={brl(k.commissionsToPay)} icon={<Percent className="h-4 w-4" />} accent="info" />
      </div>

      {/* Projeção de caixa */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink">Projeção de caixa · próximos 3 meses</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Considera recebíveis e pagáveis em aberto. Não inclui novas vendas.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="text-right">Entradas</th>
                <th className="text-right">Saídas</th>
                <th className="text-right">Saldo projetado</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((p) => (
                <tr key={p.month}>
                  <td className="text-ink">{p.month}</td>
                  <td className="text-right text-ok">{brl(p.entradas)}</td>
                  <td className="text-right text-warn">{brl(p.saidas)}</td>
                  <td className={"text-right font-medium " + (p.saldo < 0 ? "text-danger" : "text-ink")}>{brl(p.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {projection.some((p) => p.saldo < 0) && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Caixa negativo previsto em algum mês — ajuste vencimentos ou antecipe recebíveis.
          </div>
        )}
      </div>

      {/* Inadimplência & relacionamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Inadimplência" value={brl(k.overdue)} hint={pct(k.overduePct) + " sobre carteira"} icon={<AlertTriangle className="h-4 w-4" />} accent="danger" />
        <Kpi label="Parcelas vencidas" value={k.overdueCount.toString()} hint="Em atraso agora" icon={<AlertTriangle className="h-4 w-4" />} accent="danger" />
        <Kpi label="Clientes ativos" value={k.activeCustomers.toString()} hint={`${k.delinquentCustomers} inadimplentes`} icon={<Users className="h-4 w-4" />} accent="ok" />
        <Kpi label="MRR (mensal recorrente)" value={brl(k.mrr)} icon={<Repeat className="h-4 w-4" />} accent="brand" />
      </div>

      {/* Distribuições */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-ink">Receita por produto · 6 meses</h3>
          <p className="text-xs text-ink-subtle mt-0.5">Top 8 produtos por receita líquida.</p>
          <div className="mt-4"><HBarChart rows={charts.productByProduct} /></div>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-ink">Despesas por categoria · 6 meses</h3>
          <p className="text-xs text-ink-subtle mt-0.5">Top 8 categorias de despesa.</p>
          <div className="mt-4"><HBarChart rows={charts.expensesByCategory} color="#F59E0B" /></div>
        </div>
      </div>

      {/* Operação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Ticket médio (mês)" value={brl(k.ticket)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" />
        <Kpi label="Reembolsos (mês)" value={brl(k.refunds)} hint={`${k.refundsCount} no mês`} icon={<ArrowDownRight className="h-4 w-4" />} accent="warn" />
        <Kpi label="Chargebacks (mês)" value={brl(k.chargebacks)} hint={`${k.chargebacksCount} no mês`} icon={<ArrowDownRight className="h-4 w-4" />} accent="danger" />
        <Kpi label="Vencem nos próximos 30d" value={k.dueNext30Count.toString()} icon={<Wallet className="h-4 w-4" />} accent="info" />
      </div>

      {/* Mini-evolução receita 6m (sparkline) */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink">Receita bruta · evolução</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Por mês de venda — últimos 6 meses.</p>
        <div className="mt-4"><AreaChart data={charts.grossByMonth} color="#A855F7" height={180} /></div>
      </div>
    </PageShell>
  );
}

type Accent = "brand" | "ok" | "warn" | "danger" | "info";
const accentRing: Record<Accent, string> = {
  brand: "ring-brand-500/30 bg-brand-soft text-magenta-400",
  ok: "ring-ok/30 bg-ok/10 text-ok",
  warn: "ring-warn/30 bg-warn/10 text-warn",
  danger: "ring-danger/30 bg-danger/10 text-danger",
  info: "ring-info/30 bg-info/10 text-info",
};

function Kpi({ label, value, hint, icon, accent = "brand" }: { label: string; value: string; hint?: string; icon?: React.ReactNode; accent?: Accent }) {
  return (
    <div className="kpi">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-md ring-1 ${accentRing[accent]}`}>{icon}</span>}
      </div>
      <p className="kpi-value">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
