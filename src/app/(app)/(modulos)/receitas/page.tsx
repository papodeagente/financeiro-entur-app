import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { saleStatusLabel, saleOriginLabel } from "@/lib/validations";
import { requireSession } from "@/lib/session";
import { saleScope, isSellerOnly } from "@/lib/scopes";
import { NewSaleButton, type Opt, type ProductOpt } from "./_components/sale-form";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  ABERTA: "badge-info",
  CONCLUIDA: "badge-ok",
  CANCELADA: "badge-muted",
  REEMBOLSADA: "badge-warn",
  CHARGEBACK: "badge-danger",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const session = await requireSession();
  const { q, status } = await searchParams;
  const scope = saleScope(session.user.role, session.user.id);

  const where = {
    deletedAt: null,
    ...scope,
    ...(status ? { status: status as "ABERTA" } : {}),
    ...(q ? {
      OR: [
        { customer: { name: { contains: q, mode: "insensitive" as const } } },
        { product: { name: { contains: q, mode: "insensitive" as const } } },
        { notes: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };
  const sellerLocked = isSellerOnly(session.user.role);

  const [sales, customers, products, sellers, paymentMethods, bankAccounts, categories, costCenters] = await Promise.all([
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
  ]);

  type Row = (typeof sales)[number];
  const columns: Column<Row>[] = [
    { header: "Data", cell: (r) => <span className="text-xs text-ink-muted">{dateBR(r.saleDate)}</span>, width: "100px" },
    {
      header: "Cliente / Produto",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.customer.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.product.name}</div>
        </div>
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
      <DataTable rows={sales as Row[]} columns={columns} emptyTitle="Nenhuma venda registrada" emptyDescription="Cadastre uma venda em 'Nova venda' — o sistema gera as parcelas automaticamente." />
    </PageShell>
  );
}
