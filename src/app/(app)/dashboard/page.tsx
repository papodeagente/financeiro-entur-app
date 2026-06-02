import { prisma } from "@/lib/db";
import { brl, pct } from "@/lib/format";
import { PageShell } from "@/components/layout/page-shell";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Wallet, AlertTriangle, Users, Repeat, Receipt, Percent,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Money = { toNumber: () => number };
function n(d: Money | null | undefined): number {
  return d ? d.toNumber() : 0;
}

async function loadKpis() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    grossSalesMonth,
    refundsMonth,
    chargebacksMonth,
    feesMonth,
    expensesMonth,
    bankBalances,
    arOpen,
    apOpen,
    overdueInstallments,
    overdueAmount,
    totalOpenInstallments,
    rrm,
    avgTicket,
    activeCustomers,
    delinquentCustomers,
    overdueCount,
    dueNext30Count,
    refundsCount,
    chargebacksCount,
    commissionsToPay,
  ] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { grossAmount: true, netAmount: true },
      where: { saleDate: { gte: monthStart, lt: nextMonth }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    }),
    prisma.refund.aggregate({
      _sum: { amount: true },
      where: { processedAt: { gte: monthStart, lt: nextMonth } },
    }),
    prisma.chargeback.aggregate({
      _sum: { amount: true },
      where: { disputedAt: { gte: monthStart, lt: nextMonth } },
    }),
    prisma.sale.aggregate({
      _sum: { feeAmount: true },
      where: { saleDate: { gte: monthStart, lt: nextMonth }, deletedAt: null },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { competenceDate: { gte: monthStart, lt: nextMonth }, deletedAt: null, status: { not: "CANCELADO" } },
    }),
    prisma.bankAccount.aggregate({ _sum: { currentBalance: true }, where: { active: true, deletedAt: null } }),
    prisma.revenueInstallment.aggregate({
      _sum: { amount: true, paidAmount: true },
      where: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] }, deletedAt: null },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] }, deletedAt: null },
    }),
    prisma.revenueInstallment.count({ where: { status: "VENCIDO", deletedAt: null } }),
    prisma.revenueInstallment.aggregate({ _sum: { amount: true, paidAmount: true }, where: { status: "VENCIDO", deletedAt: null } }),
    prisma.revenueInstallment.aggregate({ _sum: { amount: true }, where: { deletedAt: null, status: { not: "CANCELADO" } } }),
    prisma.subscription.aggregate({ _sum: { amount: true }, where: { status: "ATIVA", deletedAt: null, period: "MENSAL" } }),
    prisma.sale.aggregate({
      _avg: { netAmount: true },
      where: { saleDate: { gte: monthStart, lt: nextMonth }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    }),
    prisma.customer.count({ where: { status: "ATIVO", deletedAt: null } }),
    prisma.customer.count({ where: { status: "INADIMPLENTE", deletedAt: null } }),
    prisma.revenueInstallment.count({ where: { status: "VENCIDO", deletedAt: null } }),
    prisma.revenueInstallment.count({
      where: {
        deletedAt: null,
        status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] },
        dueDate: { gte: now, lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30) },
      },
    }),
    prisma.refund.count({ where: { processedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.chargeback.count({ where: { disputedAt: { gte: monthStart, lt: nextMonth } } }),
    prisma.commission.aggregate({ _sum: { amount: true }, where: { status: "LIBERADA" } }),
  ]);

  const grossRevenue = n(grossSalesMonth._sum.grossAmount as Money | null);
  const refunds = n(refundsMonth._sum.amount as Money | null);
  const chargebacks = n(chargebacksMonth._sum.amount as Money | null);
  const fees = n(feesMonth._sum.feeAmount as Money | null);
  const netRevenue = grossRevenue - refunds - chargebacks - fees;
  const expenses = n(expensesMonth._sum.amount as Money | null);
  const result = netRevenue - expenses;
  const cash = n(bankBalances._sum.currentBalance as Money | null);
  const ar = n(arOpen._sum.amount as Money | null) - n(arOpen._sum.paidAmount as Money | null);
  const ap = n(apOpen._sum.amount as Money | null);
  const overdue = n(overdueAmount._sum.amount as Money | null) - n(overdueAmount._sum.paidAmount as Money | null);
  const allOpen = n(totalOpenInstallments._sum.amount as Money | null);
  const overduePct = allOpen > 0 ? (overdue / allOpen) * 100 : 0;
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

export default async function DashboardPage() {
  const k = await loadKpis();

  return (
    <PageShell
      title="Visão executiva"
      description="Resumo financeiro do mês atual e indicadores estratégicos."
    >
      {/* Linha 1 — KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Receita bruta (mês)" value={brl(k.grossRevenue)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" />
        <Kpi label="Receita líquida (mês)" value={brl(k.netRevenue)} hint="Bruto − reembolsos − chargebacks − taxas" icon={<ArrowUpRight className="h-4 w-4" />} accent="ok" />
        <Kpi label="Despesas (mês)" value={brl(k.expenses)} icon={<TrendingDown className="h-4 w-4" />} accent="warn" />
        <Kpi label="Resultado (mês)" value={brl(k.result)} hint={k.result >= 0 ? "Lucro" : "Prejuízo"} icon={k.result >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />} accent={k.result >= 0 ? "ok" : "danger"} />
      </div>

      {/* Linha 2 — Caixa & posições */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Saldo em caixa" value={brl(k.cash)} icon={<Wallet className="h-4 w-4" />} accent="info" />
        <Kpi label="A receber em aberto" value={brl(k.ar)} hint={`${k.dueNext30Count} parcelas vencem em 30 dias`} icon={<TrendingUp className="h-4 w-4" />} accent="brand" />
        <Kpi label="A pagar em aberto" value={brl(k.ap)} icon={<Receipt className="h-4 w-4" />} accent="warn" />
        <Kpi label="Comissões a pagar" value={brl(k.commissionsToPay)} icon={<Percent className="h-4 w-4" />} accent="info" />
      </div>

      {/* Linha 3 — Inadimplência & vida do cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Inadimplência" value={brl(k.overdue)} hint={pct(k.overduePct) + " sobre carteira"} icon={<AlertTriangle className="h-4 w-4" />} accent="danger" />
        <Kpi label="Parcelas vencidas" value={k.overdueCount.toString()} hint="Em atraso agora" icon={<AlertTriangle className="h-4 w-4" />} accent="danger" />
        <Kpi label="Clientes ativos" value={k.activeCustomers.toString()} hint={`${k.delinquentCustomers} inadimplentes`} icon={<Users className="h-4 w-4" />} accent="ok" />
        <Kpi label="MRR (mensal recorrente)" value={brl(k.mrr)} icon={<Repeat className="h-4 w-4" />} accent="brand" />
      </div>

      {/* Linha 4 — Operação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Ticket médio (mês)" value={brl(k.ticket)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" />
        <Kpi label="Reembolsos (mês)" value={brl(k.refunds)} hint={`${k.refundsCount} no mês`} icon={<ArrowDownRight className="h-4 w-4" />} accent="warn" />
        <Kpi label="Chargebacks (mês)" value={brl(k.chargebacks)} hint={`${k.chargebacksCount} no mês`} icon={<ArrowDownRight className="h-4 w-4" />} accent="danger" />
        <Kpi label="Vencem nos próximos 30d" value={k.dueNext30Count.toString()} icon={<Wallet className="h-4 w-4" />} accent="info" />
      </div>

      {/* Próximos passos */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink">Próximos passos</h3>
        <p className="text-sm text-ink-muted mt-1">
          Os gráficos de evolução de receita/despesa, fluxo de caixa projetado, distribuição por produto e DRE chegam na Fase 5.
          Comece cadastrando contas bancárias e produtos para os indicadores começarem a refletir movimento real.
        </p>
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

function Kpi({ label, value, hint, icon, accent = "brand" }: {
  label: string; value: string; hint?: string; icon?: React.ReactNode; accent?: Accent;
}) {
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
