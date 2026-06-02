import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { customerScope } from "@/lib/scopes";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { NewButton, RowActions, type CustomerRow } from "./_components/form";
import { customerStatusLabel } from "@/lib/validations";
import { dateBR } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  ATIVO: "badge-ok",
  INADIMPLENTE: "badge-danger",
  EM_NEGOCIACAO: "badge-warn",
  CANCELADO: "badge-muted",
  REEMBOLSADO: "badge-muted",
  EX_ALUNO: "badge-muted",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const session = await requireSession();
  const { q, status } = await searchParams;
  const scope = customerScope(session.user.role, session.user.id);
  const where = {
    deletedAt: null,
    ...scope,
    ...(status ? { status: status as "ATIVO" } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
      { document: { contains: q, mode: "insensitive" as const } },
      { company: { contains: q, mode: "insensitive" as const } },
    ]} : {}),
  };
  const baseScopeWhere = { deletedAt: null, ...scope };
  const [list, totalCount, statusCounts] = await Promise.all([
    prisma.customer.findMany({
      where, orderBy: { name: "asc" },
      include: { _count: { select: { sales: true } } },
    }),
    prisma.customer.count({ where: baseScopeWhere }),
    prisma.customer.groupBy({ by: ["status"], where: baseScopeWhere, _count: true }),
  ]);

  const rows: (CustomerRow & { firstPurchaseAt: Date | null; lastPurchaseAt: Date | null; _count: { sales: number } })[] = list.map((c) => ({
    id: c.id, name: c.name, email: c.email, phone: c.phone,
    document: c.document, company: c.company,
    addressLine: c.addressLine, city: c.city, state: c.state, zip: c.zip,
    status: c.status, origin: c.origin, notes: c.notes,
    firstPurchaseAt: c.firstPurchaseAt, lastPurchaseAt: c.lastPurchaseAt,
    _count: c._count,
  }));

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      header: "Cliente",
      cell: (r) => (
        <div>
          <div className="font-medium text-ink">{r.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">
            {r.email && <span>{r.email}</span>}
            {r.email && r.phone && <span className="mx-1">·</span>}
            {r.phone && <span>{r.phone}</span>}
            {!r.email && !r.phone && <span>—</span>}
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{customerStatusLabel[r.status]}</span>,
      width: "160px",
    },
    {
      header: "Vendas",
      cell: (r) => <span className="text-ink-muted">{r._count.sales}</span>,
      width: "80px",
      className: "text-center",
    },
    {
      header: "Última compra",
      cell: (r) => <span className="text-xs text-ink-muted">{dateBR(r.lastPurchaseAt)}</span>,
      width: "140px",
    },
    { header: "", cell: (r) => <RowActions row={r} />, className: "text-right", width: "120px" },
  ];

  const filters = [
    { label: "Todos", value: "", count: totalCount },
    ...Object.entries(customerStatusLabel).map(([v, l]) => {
      const c = statusCounts.find((x) => x.status === v);
      return { label: l, value: v, count: c?._count ?? 0 };
    }),
  ];

  return (
    <PageShell
      title="Clientes / Alunos"
      description="Cadastro financeiro dos alunos da ENTUR com status, histórico e contato."
      actions={<NewButton />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar nome, email, CPF…" />
        <div className="text-sm text-ink-muted">{list.length} de {totalCount}</div>
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
      <DataTable rows={rows} columns={columns} emptyTitle="Nenhum cliente encontrado" />
    </PageShell>
  );
}
