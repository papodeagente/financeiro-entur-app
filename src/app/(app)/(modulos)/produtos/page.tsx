import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, pct } from "@/lib/format";
import { productTypeLabel } from "@/lib/validations";
import { NewButton, RowActions, type ProductRow, type Option } from "./_components/form";
import {
  Package, GraduationCap, Sparkles, Users, Calendar, Briefcase, ShoppingBag,
  Repeat, ArrowUp, ArrowDown, Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

const typeIcons: Record<string, typeof Package> = {
  CURSO: GraduationCap, MENTORIA: Sparkles, ASSINATURA: Repeat, COMUNIDADE: Users,
  EVENTO: Calendar, CONSULTORIA: Briefcase, TREINAMENTO: GraduationCap,
  PRODUTO_DIGITAL: Package, UPSELL: ArrowUp, DOWNSELL: ArrowDown, ORDER_BUMP: ShoppingBag,
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const { q, type } = await searchParams;
  const where = {
    deletedAt: null,
    ...(type ? { type: type as "CURSO" } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const [list, allCounts, categories, costCenters] = await Promise.all([
    prisma.product.findMany({
      where, orderBy: { name: "asc" },
      include: { _count: { select: { sales: true, subscriptions: true } } },
    }),
    prisma.product.groupBy({ by: ["type"], where: { deletedAt: null }, _count: true }),
    prisma.financialCategory.findMany({ where: { kind: "RECEITA", active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const totalProducts = allCounts.reduce((a, x) => a + x._count, 0);

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
      cell: (r) => {
        const Icon = typeIcons[r.type] ?? Package;
        return (
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30 shrink-0">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className={"font-medium " + (r.active ? "text-ink" : "text-ink-subtle line-through")}>
                {r.name}
                {r.billing === "RECORRENTE" && <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-info"><Repeat className="h-3 w-3" /> recorrente</span>}
                {r.billing === "UNICA" && <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-ink-subtle"><Zap className="h-3 w-3" /> única</span>}
              </div>
              <div className="text-xs text-ink-subtle mt-0.5">
                <span>{productTypeLabel[r.type]}</span>
                {r.description && <span className="ml-2">· {r.description.slice(0, 60)}{r.description.length > 60 ? "…" : ""}</span>}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Preço",
      cell: (r) => <span className="font-medium text-ink">{brl(r.defaultPrice)}</span>,
      width: "140px",
      className: "text-right",
    },
    {
      header: "Comissão",
      cell: (r) => {
        const pctN = Number(r.defaultCommissionPercent ?? 0);
        const priceN = Number(r.defaultPrice);
        if (!pctN) return <span className="text-ink-subtle">—</span>;
        return (
          <div className="text-right">
            <div className="text-info font-medium">{pct(pctN)}</div>
            <div className="text-[10px] text-ink-subtle">{brl((priceN * pctN) / 100)}</div>
          </div>
        );
      },
      width: "120px",
      className: "text-right",
    },
    {
      header: "Vendas",
      cell: (r) => (
        <div>
          <div className="text-sm text-ink">{r._count.sales}</div>
          {r._count.subscriptions > 0 && (
            <div className="text-[10px] text-ink-subtle">{r._count.subscriptions} assinatura{r._count.subscriptions > 1 ? "s" : ""}</div>
          )}
        </div>
      ),
      width: "120px",
      className: "text-right",
    },
    { header: "Status", cell: (r) => r.active ? <span className="badge-ok">Ativo</span> : <span className="badge-muted">Inativo</span>, width: "100px" },
    { header: "", cell: (r) => <RowActions row={r} categories={cats} costCenters={ccs} />, className: "text-right", width: "120px" },
  ];

  const typeFilters = [
    { label: "Todos", value: "", count: totalProducts },
    ...Object.entries(productTypeLabel)
      .map(([v, l]) => ({ label: l, value: v, count: allCounts.find((x) => x.type === v)?._count ?? 0 }))
      .filter((f) => f.count > 0),
  ];

  return (
    <PageShell
      title="Produtos & Ofertas"
      description="Cursos, mentorias, comunidades, eventos, consultorias e produtos digitais da ENTUR."
      actions={<NewButton categories={cats} costCenters={ccs} />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar produto…" />
        <div className="text-sm text-ink-muted">{list.length} de {totalProducts}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {typeFilters.map((f) => {
          const params = new URLSearchParams();
          if (f.value) params.set("type", f.value);
          if (q) params.set("q", q);
          const active = (type ?? "") === f.value;
          return (
            <Link key={f.value || "all"} href={`?${params.toString()}`}
              className={"rounded-full px-3 py-1 text-xs ring-1 " + (active ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-bg-elev text-ink-muted ring-line hover:text-ink")}>
              {f.label} <span className="text-ink-subtle ml-1">{f.count}</span>
            </Link>
          );
        })}
      </div>
      <DataTable rows={rows} columns={columns} emptyTitle="Nenhum produto cadastrado" emptyDescription="Clique em 'Novo produto' pra começar." />
    </PageShell>
  );
}
