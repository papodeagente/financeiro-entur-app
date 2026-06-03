import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { saleStatusLabel, saleOriginLabel, saleValidationStatusLabel, saleValidationStatusBadge } from "@/lib/validations";
import { requireSession } from "@/lib/session";
import { saleScope, isSellerOnly } from "@/lib/scopes";
import { NewSaleButton, type Opt, type ProductOpt } from "./_components/sale-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  ABERTA: "badge-info",
  CONCLUIDA: "badge-ok",
  CANCELADA: "badge-muted",
  REEMBOLSADA: "badge-warn",
  CHARGEBACK: "badge-danger",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; validation?: string }> }) {
  const session = await requireSession();
  const { q, status, validation } = await searchParams;
  const scope = saleScope(session.user.role, session.user.id);

  const where = {
    deletedAt: null,
    ...scope,
    ...(status ? { status: status as "ABERTA" } : {}),
    ...(validation ? { validationStatus: validation as "PENDING_VALIDATION" } : {}),
    ...(q ? {
      OR: [
        { customer: { name: { contains: q, mode: "insensitive" as const } } },
        { product: { name: { contains: q, mode: "insensitive" as const } } },
        { notes: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };
  const sellerLocked = isSellerOnly(session.user.role);
  const isFinancial = session.user.role === "ADMIN" || session.user.role === "FINANCEIRO";

  const [sales, customers, products, sellers, paymentMethods, bankAccounts, categories, costCenters, validationCounts] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      take: 100,
      include: {
        customer: { select: { name: true } },
        product: { select: { name: true } },
        seller: { select: { name: true } },
        _count: { select: { installments: true } },
      },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, status: { notIn: ["CANCELADO", "EX_ALUNO"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true, defaultPrice: true, defaultCommissionPercent: true, billing: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.financialCategory.findMany({ where: { kind: "RECEITA", active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sale.groupBy({ by: ["validationStatus"], where: { deletedAt: null, ...scope }, _count: true }),
  ]);
  const pendingCount = validationCounts.find((x) => x.validationStatus === "PENDING_VALIDATION")?._count ?? 0;
  const adjustmentCount = validationCounts.find((x) => x.validationStatus === "NEEDS_ADJUSTMENT")?._count ?? 0;

  type Row = (typeof sales)[number];
  const columns: Column<Row>[] = [
    { header: "Data", cell: (r) => <span className="text-xs text-ink-muted">{dateBR(r.saleDate)}</span>, width: "100px" },
    {
      header: "Cliente / Produto",
      cell: (r) => (
        <Link href={`/receitas/${r.id}`} className="block hover:text-magenta-400">
          <div className="text-ink font-medium">{r.customer.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.product.name}</div>
        </Link>
      ),
    },
    { header: "Vendedor", cell: (r) => <span className="text-ink-muted text-xs">{r.seller?.name ?? "—"}</span>, width: "160px" },
    { header: "Origem", cell: (r) => <span className="badge-muted">{saleOriginLabel[r.origin]}</span>, width: "140px" },
    {
      header: "Líquido",
      cell: (r) => (
        <div className="text-right">
          <div className="text-ink font-medium">{brl(r.netAmount)}</div>
          <div className="text-xs text-ink-subtle">{r.installmentsCount > 1 ? `${r.installmentsCount}× ${brl(Number(r.netAmount)/r.installmentsCount)}` : "à vista"}</div>
        </div>
      ),
      width: "160px",
      className: "text-right",
    },
    {
      header: "Validação",
      cell: (r) => <span className={saleValidationStatusBadge[r.validationStatus] ?? "badge-muted"}>{saleValidationStatusLabel[r.validationStatus]}</span>,
      width: "160px",
    },
    { header: "Status", cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{saleStatusLabel[r.status]}</span>, width: "120px" },
  ];

  const productOpts: ProductOpt[] = products.map((p) => ({
    id: p.id, name: p.name,
    defaultPrice: p.defaultPrice.toString(),
    defaultCommissionPercent: p.defaultCommissionPercent?.toString() ?? null,
    billing: p.billing,
  }));
  const opt = (xs: { id: string; name: string }[]): Opt[] => xs.map((x) => ({ id: x.id, name: x.name }));

  // KPIs do topo
  const totalNet = sales.reduce((a, s) => a + Number(s.netAmount), 0);

  return (
    <PageShell
      title="Receitas"
      description="Cadastro das vendas. Cada venda gera parcelas automaticamente em Contas a receber."
      actions={
        <NewSaleButton
          customers={opt(customers)}
          products={productOpts}
          sellers={opt(sellers)}
          paymentMethods={opt(paymentMethods)}
          bankAccounts={opt(bankAccounts)}
          categories={opt(categories)}
          costCenters={opt(costCenters)}
        />
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar cliente, produto, observação…" />
        <div className="text-sm text-ink-muted">
          {sales.length} vendas · Total líquido <span className="text-ink font-medium">{brl(totalNet)}</span>
        </div>
      </div>
      {isFinancial && (pendingCount > 0 || adjustmentCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={validation === "PENDING_VALIDATION" ? "/receitas" : "/receitas?validation=PENDING_VALIDATION"}
            className={"rounded-full px-3 py-1 text-xs ring-1 " + (validation === "PENDING_VALIDATION" ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-warn/10 text-warn ring-warn/30 hover:brightness-110")}>
            Aguardando validação <span className="ml-1 font-semibold">{pendingCount}</span>
          </Link>
          {adjustmentCount > 0 && (
            <Link href="/receitas?validation=NEEDS_ADJUSTMENT" className="rounded-full px-3 py-1 text-xs ring-1 bg-info/10 text-info ring-info/30">
              Ajuste solicitado <span className="ml-1 font-semibold">{adjustmentCount}</span>
            </Link>
          )}
          {validation && <Link href="/receitas" className="text-xs text-ink-muted hover:text-ink">Limpar filtro</Link>}
        </div>
      )}
      <DataTable rows={sales as Row[]} columns={columns} emptyTitle="Nenhuma venda registrada" emptyDescription="Cadastre uma venda em 'Nova venda' — o sistema gera as parcelas automaticamente." />
    </PageShell>
  );
}
