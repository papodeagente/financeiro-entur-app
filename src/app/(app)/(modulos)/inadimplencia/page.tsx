import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { brl, dateBR, pct } from "@/lib/format";
import { syncOverdueInstallments } from "@/lib/finance-ops";
import { bucketOf, daysOverdue, type DelinquencyBucket } from "@/lib/dates";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  await syncOverdueInstallments();

  const [overdueInstallments, allOpenAgg] = await Promise.all([
    prisma.revenueInstallment.findMany({
      where: { deletedAt: null, status: "VENCIDO" },
      include: {
        sale: {
          select: {
            id: true, installmentsCount: true,
            customer: { select: { id: true, name: true } },
            product: { select: { name: true } },
            seller: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    }),
    prisma.revenueInstallment.aggregate({
      _sum: { amount: true, paidAmount: true },
      where: { deletedAt: null, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] } },
    }),
  ]);

  const overdueTotal = overdueInstallments.reduce((a, i) => a + (Number(i.amount) - Number(i.paidAmount)), 0);
  const allOpen = Number(allOpenAgg._sum.amount ?? 0) - Number(allOpenAgg._sum.paidAmount ?? 0);
  const overduePct = allOpen > 0 ? (overdueTotal / allOpen) * 100 : 0;

  const today = new Date();
  const buckets: Record<DelinquencyBucket, { count: number; amount: number }> = {
    "1-7": { count: 0, amount: 0 }, "8-15": { count: 0, amount: 0 }, "16-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 }, "61-90": { count: 0, amount: 0 }, "90+": { count: 0, amount: 0 },
  };
  let sumDays = 0;
  const byCustomer = new Map<string, { id: string; name: string; total: number; count: number; worstDays: number; productMix: Set<string> }>();
  for (const i of overdueInstallments) {
    const days = daysOverdue(i.dueDate, today);
    const open = Number(i.amount) - Number(i.paidAmount);
    const b = bucketOf(days);
    if (b) { buckets[b].count += 1; buckets[b].amount += open; }
    sumDays += days;
    const k = i.sale.customer.id;
    const prev = byCustomer.get(k) ?? { id: k, name: i.sale.customer.name, total: 0, count: 0, worstDays: 0, productMix: new Set<string>() };
    prev.total += open;
    prev.count += 1;
    prev.worstDays = Math.max(prev.worstDays, days);
    prev.productMix.add(i.sale.product.name);
    byCustomer.set(k, prev);
  }
  const avgDays = overdueInstallments.length > 0 ? Math.round(sumDays / overdueInstallments.length) : 0;
  const customers = Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);

  const bucketsArr: { key: DelinquencyBucket; count: number; amount: number; tone: string }[] = [
    { key: "1-7", count: buckets["1-7"].count, amount: buckets["1-7"].amount, tone: "text-warn ring-warn/30 bg-warn/10" },
    { key: "8-15", count: buckets["8-15"].count, amount: buckets["8-15"].amount, tone: "text-warn ring-warn/30 bg-warn/10" },
    { key: "16-30", count: buckets["16-30"].count, amount: buckets["16-30"].amount, tone: "text-danger ring-danger/30 bg-danger/10" },
    { key: "31-60", count: buckets["31-60"].count, amount: buckets["31-60"].amount, tone: "text-danger ring-danger/30 bg-danger/10" },
    { key: "61-90", count: buckets["61-90"].count, amount: buckets["61-90"].amount, tone: "text-danger ring-danger/30 bg-danger/10" },
    { key: "90+", count: buckets["90+"].count, amount: buckets["90+"].amount, tone: "text-danger ring-danger/30 bg-danger/10" },
  ];

  type Row = (typeof customers)[number];
  const columns: Column<Row>[] = [
    { header: "Cliente", cell: (r) => <a href={`/clientes?q=${encodeURIComponent(r.name)}`} className="text-ink font-medium hover:text-magenta-400">{r.name}</a> },
    { header: "Parcelas vencidas", cell: (r) => <span className="text-ink-muted">{r.count}</span>, width: "140px", className: "text-center" },
    { header: "Pior atraso", cell: (r) => <span className="text-danger font-medium">{r.worstDays} dia{r.worstDays > 1 ? "s" : ""}</span>, width: "140px" },
    { header: "Produtos", cell: (r) => <span className="text-xs text-ink-muted">{Array.from(r.productMix).slice(0, 3).join(", ")}{r.productMix.size > 3 ? ` (+${r.productMix.size - 3})` : ""}</span> },
    { header: "Valor em atraso", cell: (r) => <span className="text-danger font-medium">{brl(r.total)}</span>, width: "160px", className: "text-right" },
  ];

  return (
    <PageShell
      title="Inadimplência"
      description="Faixas de atraso, clientes em atraso e ações de cobrança."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total inadimplente" value={brl(overdueTotal)} accent="danger" />
        <Kpi label="% sobre carteira aberta" value={pct(overduePct)} accent="danger" />
        <Kpi label="Clientes inadimplentes" value={customers.length.toString()} accent="warn" />
        <Kpi label="Tempo médio de atraso" value={`${avgDays} dia${avgDays !== 1 ? "s" : ""}`} accent="warn" />
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink">Faixas de atraso</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Valor em aberto agrupado pelo tempo de atraso da parcela.</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {bucketsArr.map((b) => (
            <div key={b.key} className={`rounded-xl ring-1 p-4 ${b.tone}`}>
              <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80">{b.key} dias</p>
              <p className="mt-1 text-lg font-semibold">{brl(b.amount)}</p>
              <p className="text-xs opacity-80">{b.count} parcela{b.count !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" /> Clientes em atraso
        </h3>
        <DataTable
          rows={customers as Row[]}
          columns={columns}
          emptyTitle="Sem inadimplência no momento"
          emptyDescription="Quando parcelas vencerem sem pagamento, elas aparecem aqui agrupadas por cliente."
        />
      </div>
    </PageShell>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: "danger" | "warn" }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className={"mt-2 text-2xl font-semibold " + (accent === "danger" ? "text-danger" : "text-warn")}>{value}</p>
    </div>
  );
}
