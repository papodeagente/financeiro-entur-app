import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { NewButton, RowActions } from "./_components/toolbar";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; kind: "RECEITA" | "DESPESA"; active: boolean; _count: { products: number; sales: number; expenses: number } };

export default async function CategoriasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const where = {
    deletedAt: null,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const list = await prisma.financialCategory.findMany({
    where,
    include: { _count: { select: { products: true, sales: true, expenses: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const receitas = list.filter((c) => c.kind === "RECEITA");
  const despesas = list.filter((c) => c.kind === "DESPESA");

  const columns: Column<Row>[] = [
    {
      header: "Nome",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className={r.active ? "text-ink" : "text-ink-subtle line-through"}>{r.name}</span>
          {!r.active && <span className="badge-muted">inativa</span>}
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
    {
      header: "",
      cell: (r) => <RowActions row={r} />,
      className: "text-right",
      width: "120px",
    },
  ];

  return (
    <PageShell
      title="Categorias financeiras"
      description="Estrutura de receitas e despesas — base da DRE e dos relatórios estratégicos."
      actions={<NewButton />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar categoria…" />
        <div className="text-sm text-ink-muted">{list.length} categorias</div>
      </div>
      <div className="space-y-4">
        <section>
          <h3 className="text-xs uppercase tracking-widest text-ink-subtle mb-2">Receitas</h3>
          <DataTable rows={receitas as Row[]} columns={columns} emptyTitle="Nenhuma categoria de receita" />
        </section>
        <section>
          <h3 className="text-xs uppercase tracking-widest text-ink-subtle mb-2">Despesas</h3>
          <DataTable rows={despesas as Row[]} columns={columns} emptyTitle="Nenhuma categoria de despesa" />
        </section>
      </div>
    </PageShell>
  );
}
