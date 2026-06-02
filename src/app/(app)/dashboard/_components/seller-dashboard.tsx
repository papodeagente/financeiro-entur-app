import { prisma } from "@/lib/db";
import { brl, pct, dateBR } from "@/lib/format";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { currentPeriod, lastNMonths } from "@/lib/period";
import { syncOverdueInstallments } from "@/lib/finance-ops";
import { AreaChart, type AreaPoint } from "@/components/charts/area-chart";
import { Target, TrendingUp, Percent, AlertTriangle, Wallet } from "lucide-react";

const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

export async function SellerDashboard({ userId, userName }: { userId: string; userName: string }) {
  await syncOverdueInstallments();
  const p = currentPeriod("mes");
  const months6 = lastNMonths(6);

  const [salesMonth, salesAll, commissionsLib, commissionsPend, overdueInst, goal, salesByMonth] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { netAmount: true }, _avg: { netAmount: true }, _count: true,
      where: { sellerId: userId, saleDate: { gte: p.start, lt: p.end }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    }),
    prisma.sale.aggregate({
      _sum: { netAmount: true }, _count: true,
      where: { sellerId: userId, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    }),
    prisma.commission.aggregate({ _sum: { amount: true }, _count: true, where: { payeeId: userId, status: "LIBERADA" } }),
    prisma.commission.aggregate({ _sum: { amount: true }, _count: true, where: { payeeId: userId, status: "PENDENTE" } }),
    prisma.revenueInstallment.findMany({
      where: { deletedAt: null, status: "VENCIDO", sale: { sellerId: userId } },
      take: 20, orderBy: { dueDate: "asc" },
      include: { sale: { select: { installmentsCount: true, customer: { select: { name: true } }, product: { select: { name: true } } } } },
    }),
    prisma.salesGoal.findUnique({
      where: { userId_year_month: { userId, year: p.year, month: p.month ?? 1 } },
    }),
    Promise.all(months6.map(async (m) => {
      const a = await prisma.sale.aggregate({
        _sum: { netAmount: true },
        where: { sellerId: userId, saleDate: { gte: m.start, lt: m.end }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
      });
      return { label: m.label.split(" ")[0], value: num(a._sum.netAmount) };
    })),
  ]);

  const monthRevenue = num(salesMonth._sum.netAmount);
  const allTimeRevenue = num(salesAll._sum.netAmount);
  const ticket = num(salesMonth._avg.netAmount);
  const goalAmount = num(goal?.targetAmount);
  const goalSales = goal?.targetSales ?? null;
  const attainment = goalAmount > 0 ? (monthRevenue / goalAmount) * 100 : null;
  const liberadasValue = num(commissionsLib._sum.amount);
  const pendentesValue = num(commissionsPend._sum.amount);

  const series: AreaPoint[] = salesByMonth;

  type Row = (typeof overdueInst)[number];
  const overdueColumns: Column<Row>[] = [
    { header: "Cliente / Produto", cell: (r) => (
      <div>
        <div className="text-ink">{r.sale.customer.name}</div>
        <div className="text-xs text-ink-subtle mt-0.5">{r.sale.product.name}</div>
      </div>
    )},
    { header: "Parcela", cell: (r) => <span className="text-xs text-ink-muted">{r.number}/{r.sale.installmentsCount}</span>, width: "100px" },
    { header: "Vencimento", cell: (r) => <span className="text-xs text-danger">{dateBR(r.dueDate)}</span>, width: "120px" },
    { header: "Valor", cell: (r) => <span className="text-danger font-medium">{brl(num(r.amount) - num(r.paidAmount))}</span>, width: "140px", className: "text-right" },
  ];

  return (
    <PageShell title={`Olá, ${userName}`} description={`Seu desempenho em ${p.label}.`}>
      {/* Meta + Atingimento */}
      {goal ? (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30">
                <Target className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">Meta do mês</h3>
                <p className="text-xs text-ink-muted">{brl(monthRevenue)} de {brl(goalAmount)}{goalSales ? ` · ${salesMonth._count}/${goalSales} vendas` : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={"text-3xl font-bold " + ((attainment ?? 0) >= 100 ? "text-ok" : (attainment ?? 0) >= 70 ? "text-warn" : "text-danger")}>{attainment !== null ? pct(attainment) : "—"}</p>
              <p className="text-[11px] text-ink-subtle uppercase tracking-widest">atingimento</p>
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-bg-elev overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, attainment ?? 0)}%`, background: "linear-gradient(90deg, #8B33F2, #FF1AB5)" }}
            />
          </div>
          {attainment !== null && attainment < 100 && (
            <p className="mt-2 text-xs text-ink-muted">Faltam <strong className="text-ink">{brl(Math.max(0, goalAmount - monthRevenue))}</strong> pra fechar a meta.</p>
          )}
        </div>
      ) : (
        <div className="card p-6 text-sm text-ink-muted">Você ainda não tem meta de vendas para este mês. Peça pro admin/gestor cadastrar em Configurações → Metas.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Vendido (mês)" value={brl(monthRevenue)} hint={`${salesMonth._count} venda${salesMonth._count !== 1 ? "s" : ""}`} icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi label="Ticket médio (mês)" value={brl(ticket)} icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="Comissões a receber" value={brl(liberadasValue)} hint={`+ ${brl(pendentesValue)} aguardando pgto cliente`} icon={<Percent className="h-4 w-4" />} accent="ok" />
        <Kpi label="Inadimplentes (minhas)" value={overdueInst.length.toString()} hint={`${brl(overdueInst.reduce((a, i) => a + num(i.amount) - num(i.paidAmount), 0))} em atraso`} icon={<AlertTriangle className="h-4 w-4" />} accent={overdueInst.length > 0 ? "danger" : "ok"} />
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink">Minhas vendas — últimos 6 meses</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Receita líquida que você gerou por mês.</p>
        <div className="mt-4"><AreaChart data={series} color="#A855F7" height={180} /></div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Inadimplentes meus (top 20)</h3>
        <DataTable
          rows={overdueInst as Row[]}
          columns={overdueColumns}
          emptyTitle="Nenhum cliente seu inadimplente"
          emptyDescription="Quando uma parcela atrasar, ela aparece aqui pra você cobrar."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Kpi label="Receita total (todos os tempos)" value={brl(allTimeRevenue)} hint={`${salesAll._count} vendas no histórico`} />
        <Kpi label="Comissões pagas no histórico" value={brl(num(commissionsLib._sum.amount) + pendentesValue)} hint="(soma liberadas + pendentes; pagas históricas em /comissoes)" />
      </div>
    </PageShell>
  );
}

type Accent = "brand" | "ok" | "warn" | "danger";
const tone: Record<Accent, string> = {
  brand: "ring-brand-500/30 bg-brand-soft text-magenta-400",
  ok: "ring-ok/30 bg-ok/10 text-ok",
  warn: "ring-warn/30 bg-warn/10 text-warn",
  danger: "ring-danger/30 bg-danger/10 text-danger",
};
function Kpi({ label, value, hint, icon, accent = "brand" }: { label: string; value: string; hint?: string; icon?: React.ReactNode; accent?: Accent }) {
  return (
    <div className="kpi">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-md ring-1 ${tone[accent]}`}>{icon}</span>}
      </div>
      <p className="kpi-value">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
