import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { syncOverdueInstallments } from "@/lib/finance-ops";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  await syncOverdueInstallments();

  const where = {
    deletedAt: null,
    installmentsCount: { gt: 1 },
    status: { notIn: ["CANCELADA" as const] },
    ...(q ? { OR: [
      { customer: { name: { contains: q, mode: "insensitive" as const } } },
      { product: { name: { contains: q, mode: "insensitive" as const } } },
    ]} : {}),
  };

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { saleDate: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      product: { select: { name: true } },
      installments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true, status: true, dueDate: true } },
    },
  });

  type Row = (typeof sales)[number] & { paid: number; remaining: number; overdueCount: number; nextDue: Date | null };
  const rows: Row[] = sales.map((s) => {
    const total = Number(s.netAmount);
    const paid = s.installments.reduce((a, i) => a + Number(i.paidAmount), 0);
    const remaining = +(total - paid).toFixed(2);
    const overdueCount = s.installments.filter((i) => i.status === "VENCIDO").length;
    const nextPending = s.installments
      .filter((i) => ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"].includes(i.status))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    return { ...s, paid, remaining, overdueCount, nextDue: nextPending?.dueDate ?? null };
  });

  const totalOpen = rows.reduce((a, r) => a + r.remaining, 0);

  const columns: Column<Row>[] = [
    {
      header: "Cliente / Produto",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.customer.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.product.name}</div>
        </div>
      ),
    },
    {
      header: "Parcelas",
      cell: (r) => {
        const paidCount = r.installments.filter((i) => i.status === "PAGO").length;
        return <span className="text-xs text-ink-muted">{paidCount}/{r.installmentsCount} pagas</span>;
      },
      width: "140px",
    },
    {
      header: "Total",
      cell: (r) => (
        <div className="text-right">
          <div className="text-ink font-medium">{brl(r.netAmount)}</div>
          <div className="text-xs text-ink-subtle">venda em {dateBR(r.saleDate)}</div>
        </div>
      ),
      width: "160px",
      className: "text-right",
    },
    {
      header: "Pago",
      cell: (r) => <span className="text-ok font-medium">{brl(r.paid)}</span>,
      width: "120px",
      className: "text-right",
    },
    {
      header: "Saldo devedor",
      cell: (r) => <span className={"font-medium " + (r.remaining > 0 ? "text-magenta-400" : "text-ink-subtle")}>{brl(r.remaining)}</span>,
      width: "140px",
      className: "text-right",
    },
    {
      header: "Próximo vencimento",
      cell: (r) => (
        <div>
          <div className="text-xs text-ink">{dateBR(r.nextDue)}</div>
          {r.overdueCount > 0 && (
            <div className="text-xs text-danger mt-0.5">{r.overdueCount} parcela{r.overdueCount > 1 ? "s" : ""} vencida{r.overdueCount > 1 ? "s" : ""}</div>
          )}
        </div>
      ),
      width: "180px",
    },
  ];

  return (
    <PageShell
      title="Parcelamentos"
      description="Vendas com mais de uma parcela. Acompanhe saldo devedor e parcelas em atraso."
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar cliente ou produto…" />
        <div className="text-sm text-ink-muted">
          {rows.length} vendas parceladas · Saldo devedor total: <span className="text-ink font-medium">{brl(totalOpen)}</span>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        emptyTitle="Nenhuma venda parcelada"
        emptyDescription="Cadastre uma venda em Receitas com mais de 1 parcela."
      />
    </PageShell>
  );
}
