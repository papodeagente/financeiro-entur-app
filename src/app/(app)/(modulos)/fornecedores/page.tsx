import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { NewButton, RowActions, type SupplierRow } from "./_components/form";

export const dynamic = "force-dynamic";

type Row = SupplierRow & { _count: { expenses: number } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const where = {
    deletedAt: null,
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { category: { contains: q, mode: "insensitive" as const } },
      { document: { contains: q, mode: "insensitive" as const } },
    ]} : {}),
  };
  const list = await prisma.supplier.findMany({
    where,
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: "asc" },
  });

  const columns: Column<Row>[] = [
    {
      header: "Fornecedor",
      cell: (r) => (
        <div>
          <div className={"font-medium " + (r.active ? "text-ink" : "text-ink-subtle line-through")}>{r.name}</div>
          {r.email && <div className="text-xs text-ink-subtle mt-0.5">{r.email}</div>}
        </div>
      ),
    },
    { header: "Categoria", cell: (r) => r.category ? <span className="badge-muted">{r.category}</span> : <span className="text-ink-subtle">—</span>, width: "180px" },
    { header: "Doc.", cell: (r) => <span className="text-ink-muted text-xs">{r.document ?? "—"}</span>, width: "160px" },
    { header: "Despesas", cell: (r) => <span className="text-ink-muted text-xs">{r._count.expenses}</span>, width: "100px", className: "text-center" },
    { header: "", cell: (r) => <RowActions row={r} />, className: "text-right", width: "120px" },
  ];

  return (
    <PageShell
      title="Fornecedores"
      description="Cadastro de SaaS, prestadores de serviço, agências, plataformas e parceiros."
      actions={<NewButton />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar nome, categoria ou CNPJ…" />
        <div className="text-sm text-ink-muted">{list.length} fornecedores</div>
      </div>
      <DataTable rows={list as Row[]} columns={columns} emptyTitle="Nenhum fornecedor cadastrado" />
    </PageShell>
  );
}
