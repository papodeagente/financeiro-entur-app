import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { NewButton, RowActions, type CostCenterRow } from "./_components/form";

export const dynamic = "force-dynamic";

type Row = CostCenterRow & { _count: { products: number; sales: number; expenses: number } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const where = {
    deletedAt: null,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const list = await prisma.costCenter.findMany({
    where,
    include: { _count: { select: { products: true, sales: true, expenses: true } } },
    orderBy: { name: "asc" },
  });

  const columns: Column<Row>[] = [
    {
      header: "Centro",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className={r.active ? "text-ink" : "text-ink-subtle line-through"}>{r.name}</span>
          {!r.active && <span className="badge-muted">inativo</span>}
        </div>
      ),
    },
    {
      header: "Uso",
      cell: (r) => (
        <span className="text-xs text-ink-muted">
          {r._count.products} produtos · {r._count.sales} vendas · {r._count.expenses} despesas
        </span>
      ),
      width: "320px",
    },
    { header: "", cell: (r) => <RowActions row={r} />, className: "text-right", width: "120px" },
  ];

  return (
    <PageShell
      title="Centros de custo"
      description="Áreas e equipes que originam custos e receitas — análise por área."
      actions={<NewButton />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar centro…" />
        <div className="text-sm text-ink-muted">{list.length} centros</div>
      </div>
      <DataTable rows={list as Row[]} columns={columns} emptyTitle="Nenhum centro de custo" />
    </PageShell>
  );
}
