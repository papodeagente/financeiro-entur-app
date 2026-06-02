import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, pct } from "@/lib/format";
import { productTypeLabel, productBillingLabel } from "@/lib/validations";
import { NewButton, RowActions, type ProductRow, type Option } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const where = {
    deletedAt: null,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const [list, categories, costCenters] = await Promise.all([
    prisma.product.findMany({
      where, orderBy: { name: "asc" },
      include: { _count: { select: { sales: true, subscriptions: true } } },
    }),
    prisma.financialCategory.findMany({ where: { kind: "RECEITA", active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: (ProductRow & { _count: { sales: number; subscriptions: number } })[] = list.map((p) => ({
    id: p.id, name: p.name, description: p.description,
    type: p.type, billing: p.billing,
    defaultPrice: p.defaultPrice.toString(),
    estimatedCost: p.estimatedCost?.toString() ?? null,
    estimatedMargin: p.estimatedMargin?.toString() ?? null,
    defaultCommissionPercent: p.defaultCommissionPercent?.toString() ?? null,
    accessDurationDays: p.accessDurationDays,
    categoryId: p.categoryId, costCenterId: p.costCenterId,
    active: p.active, notes: p.notes,
    _count: p._count,
  }));

  const cats: Option[] = categories.map((c) => ({ id: c.id, name: c.name }));
  const ccs: Option[] = costCenters.map((c) => ({ id: c.id, name: c.name }));

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      header: "Produto",
      cell: (r) => (
        <div>
          <div className={"font-medium " + (r.active ? "text-ink" : "text-ink-subtle line-through")}>{r.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">
            <span className="badge-muted">{productTypeLabel[r.type]}</span>
            <span className="ml-1 badge-muted">{productBillingLabel[r.billing]}</span>
          </div>
        </div>
      ),
    },
    { header: "Preço padrão", cell: (r) => <span className="font-medium text-ink">{brl(r.defaultPrice)}</span>, width: "140px", className: "text-right" },
    { header: "Comissão", cell: (r) => r.defaultCommissionPercent ? <span className="text-info">{pct(Number(r.defaultCommissionPercent))}</span> : <span className="text-ink-subtle">—</span>, width: "100px", className: "text-right" },
    { header: "Vendas", cell: (r) => <span className="text-xs text-ink-muted">{r._count.sales} venda(s) · {r._count.subscriptions} assinatura(s)</span>, width: "240px" },
    { header: "", cell: (r) => <RowActions row={r} categories={cats} costCenters={ccs} />, className: "text-right", width: "120px" },
  ];

  return (
    <PageShell
      title="Produtos & Ofertas"
      description="Cursos, mentorias, comunidades, eventos, consultorias e produtos digitais da ENTUR."
      actions={<NewButton categories={cats} costCenters={ccs} />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar produto…" />
        <div className="text-sm text-ink-muted">{list.length} produtos</div>
      </div>
      <DataTable rows={rows} columns={columns} emptyTitle="Nenhum produto cadastrado" />
    </PageShell>
  );
}
