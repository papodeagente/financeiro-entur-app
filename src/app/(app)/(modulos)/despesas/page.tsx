import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { expenseStatusLabel, expenseRecurrenceLabel } from "@/lib/validations";
import { syncOverdueExpenses } from "@/lib/finance-ops";
import { NewButton, RowActions, type ExpenseRow, type Opt } from "./_components/form";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  PENDENTE: "badge-info",
  PAGO: "badge-ok",
  VENCIDO: "badge-danger",
  CANCELADO: "badge-muted",
  AGENDADO: "badge-warn",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  await syncOverdueExpenses();

  const where = {
    deletedAt: null,
    ...(status ? { status: status as "PENDENTE" } : {}),
    ...(q ? { OR: [
      { description: { contains: q, mode: "insensitive" as const } },
      { supplier: { name: { contains: q, mode: "insensitive" as const } } },
    ]} : {}),
  };

  const [list, suppliers, categories, costCenters, bankAccounts, paymentMethods, users, statusCounts] = await Promise.all([
    prisma.expense.findMany({
      where, orderBy: { dueDate: "desc" }, take: 200,
      include: {
        supplier: { select: { name: true } },
        category: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
    }),
    prisma.supplier.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.financialCategory.findMany({ where: { kind: "DESPESA", active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.expense.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);

  const opt = (xs: { id: string; name: string }[]): Opt[] => xs.map((x) => ({ id: x.id, name: x.name }));

  const rowsForUI: (ExpenseRow & { supplier: { name: string } | null; category: { name: string } | null; costCenter: { name: string } | null })[] = list.map((e) => ({
    id: e.id, description: e.description,
    supplierId: e.supplierId, categoryId: e.categoryId, costCenterId: e.costCenterId,
    bankAccountId: e.bankAccountId, paymentMethodId: e.paymentMethodId, responsibleId: e.responsibleId,
    amount: e.amount.toString(), dueDate: e.dueDate.toISOString(), competenceDate: e.competenceDate.toISOString(),
    recurrence: e.recurrence, status: e.status, attachmentUrl: e.attachmentUrl, notes: e.notes,
    supplier: e.supplier, category: e.category, costCenter: e.costCenter,
  }));

  type Row = (typeof rowsForUI)[number];
  const columns: Column<Row>[] = [
    {
      header: "Descrição / Fornecedor",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.description}</div>
          <div className="text-xs text-ink-subtle mt-0.5">
            {r.supplier?.name ?? "Sem fornecedor"}
            {r.category && <> · <span className="text-ink-muted">{r.category.name}</span></>}
            {r.costCenter && <> · <span className="text-ink-muted">{r.costCenter.name}</span></>}
          </div>
        </div>
      ),
    },
    { header: "Vencimento", cell: (r) => <span className="text-xs text-ink">{dateBR(r.dueDate)}</span>, width: "120px" },
    { header: "Valor", cell: (r) => <span className="font-medium text-ink">{brl(r.amount)}</span>, width: "140px", className: "text-right" },
    { header: "Recorrência", cell: (r) => r.recurrence !== "NENHUMA" ? <span className="badge-muted">{expenseRecurrenceLabel[r.recurrence]}</span> : <span className="text-ink-subtle">—</span>, width: "140px" },
    { header: "Status", cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{expenseStatusLabel[r.status]}</span>, width: "120px" },
    {
      header: "",
      cell: (r) => (
        <RowActions row={r} suppliers={opt(suppliers)} categories={opt(categories)} costCenters={opt(costCenters)} bankAccounts={opt(bankAccounts)} paymentMethods={opt(paymentMethods)} users={opt(users)} />
      ),
      className: "text-right",
      width: "160px",
    },
  ];

  const filters = [
    { label: "Todas", value: "", count: list.length },
    ...Object.entries(expenseStatusLabel).map(([v, l]) => {
      const c = statusCounts.find((x) => x.status === v);
      return { label: l, value: v, count: c?._count ?? 0 };
    }),
  ];

  const totalMonth = list.filter(e => e.status !== "CANCELADO").reduce((a, e) => a + Number(e.amount), 0);

  return (
    <PageShell
      title="Despesas"
      description="Despesas únicas e recorrentes da operação. Recorrências geram ocorrências agendadas automaticamente."
      actions={<NewButton suppliers={opt(suppliers)} categories={opt(categories)} costCenters={opt(costCenters)} bankAccounts={opt(bankAccounts)} paymentMethods={opt(paymentMethods)} users={opt(users)} />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar descrição ou fornecedor…" />
        <div className="text-sm text-ink-muted">
          {list.length} despesas · Total: <span className="text-ink font-medium">{brl(totalMonth)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const params = new URLSearchParams();
          if (f.value) params.set("status", f.value);
          if (q) params.set("q", q);
          const active = (status ?? "") === f.value;
          return (
            <a key={f.value || "all"} href={`?${params.toString()}`}
              className={"rounded-full px-3 py-1 text-xs ring-1 " + (active ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-bg-elev text-ink-muted ring-line hover:text-ink")}>
              {f.label} <span className="text-ink-subtle ml-1">{f.count}</span>
            </a>
          );
        })}
      </div>
      <DataTable rows={rowsForUI} columns={columns} emptyTitle="Nenhuma despesa registrada" emptyDescription="Cadastre despesas únicas ou recorrentes da operação." />
    </PageShell>
  );
}
