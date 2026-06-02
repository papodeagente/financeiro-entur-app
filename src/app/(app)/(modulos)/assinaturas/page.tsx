import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { subscriptionStatusLabel, subscriptionPeriodLabel } from "@/lib/validations";
import { NewButton, RowActions, type Opt, type ProductOpt, type SubRow } from "./_components/form";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  ATIVA: "badge-ok", PENDENTE: "badge-info", INADIMPLENTE: "badge-danger",
  CANCELADA: "badge-muted", PAUSADA: "badge-warn", EXPIRADA: "badge-muted",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const where = {
    deletedAt: null,
    ...(status ? { status: status as "ATIVA" } : {}),
    ...(q ? { OR: [
      { customer: { name: { contains: q, mode: "insensitive" as const } } },
      { product: { name: { contains: q, mode: "insensitive" as const } } },
    ]} : {}),
  };

  const [subs, customers, products, paymentMethods, bankAccounts, statusCounts] = await Promise.all([
    prisma.subscription.findMany({
      where, orderBy: { nextChargeAt: "asc" }, take: 200,
      include: {
        customer: { select: { name: true } },
        product: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, status: { notIn: ["CANCELADO", "EX_ALUNO"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true, defaultPrice: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subscription.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);

  const productOpts: ProductOpt[] = products.map((p) => ({ id: p.id, name: p.name, defaultPrice: p.defaultPrice.toString() }));
  const opt = (xs: { id: string; name: string }[]): Opt[] => xs.map((x) => ({ id: x.id, name: x.name }));

  const mrr = subs.filter((s) => s.status === "ATIVA" && s.period === "MENSAL").reduce((a, s) => a + Number(s.amount), 0);

  const rowsForUI: (SubRow & { customer: { name: string }; product: { name: string }; paymentMethod: { name: string } | null })[] = subs.map((s) => ({
    id: s.id, customerId: s.customerId, productId: s.productId,
    amount: s.amount.toString(), period: s.period,
    startDate: s.startDate.toISOString(),
    nextChargeAt: s.nextChargeAt?.toISOString() ?? null,
    paymentMethodId: s.paymentMethodId, expiresAt: s.expiresAt?.toISOString() ?? null,
    status: s.status,
    customer: s.customer, product: s.product, paymentMethod: s.paymentMethod,
  }));

  type Row = (typeof rowsForUI)[number];
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
    { header: "Valor / Periodicidade", cell: (r) => (
      <div>
        <div className="text-ink font-medium">{brl(r.amount)}</div>
        <div className="text-xs text-ink-subtle mt-0.5">{subscriptionPeriodLabel[r.period]}</div>
      </div>
    ), width: "180px" },
    { header: "Próxima cobrança", cell: (r) => <span className="text-xs text-ink">{dateBR(r.nextChargeAt)}</span>, width: "160px" },
    { header: "Status", cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{subscriptionStatusLabel[r.status]}</span>, width: "140px" },
    {
      header: "",
      cell: (r) => <RowActions row={r} customers={opt(customers)} products={productOpts} paymentMethods={opt(paymentMethods)} bankAccounts={opt(bankAccounts)} />,
      className: "text-right",
      width: "200px",
    },
  ];

  const filters = [
    { label: "Todas", value: "", count: subs.length },
    ...Object.entries(subscriptionStatusLabel).map(([v, l]) => {
      const c = statusCounts.find((x) => x.status === v);
      return { label: l, value: v, count: c?._count ?? 0 };
    }),
  ];

  return (
    <PageShell
      title="Assinaturas & Recorrências"
      description="Cobranças automáticas que se repetem por período. MRR é o motor do recorrente."
      actions={<NewButton customers={opt(customers)} products={productOpts} paymentMethods={opt(paymentMethods)} />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar cliente ou produto…" />
        <div className="text-sm text-ink-muted">
          MRR (mensal) ativo: <span className="text-ink font-medium">{brl(mrr)}</span>
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
      <DataTable rows={rowsForUI} columns={columns} emptyTitle="Nenhuma assinatura" emptyDescription="Cadastre uma assinatura para começar a acompanhar MRR." />
    </PageShell>
  );
}
