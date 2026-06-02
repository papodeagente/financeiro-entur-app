import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { commissionScope } from "@/lib/scopes";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR, pct } from "@/lib/format";
import { commissionStatusLabel } from "@/lib/validations";
import { CommissionActions, type CommissionQuick, type Opt } from "./_components/row-actions";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  PENDENTE: "badge-info", LIBERADA: "badge-warn", BLOQUEADA: "badge-danger",
  PAGA: "badge-ok", CANCELADA: "badge-muted", ESTORNADA: "badge-muted",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const session = await requireSession();
  const { q, status } = await searchParams;
  const scope = commissionScope(session.user.role, session.user.id);
  const where = {
    deletedAt: null,
    ...scope,
    ...(status ? { status: status as "PENDENTE" } : {}),
    ...(q ? {
      OR: [
        { payee: { name: { contains: q, mode: "insensitive" as const } } },
        { sale: { customer: { name: { contains: q, mode: "insensitive" as const } } } },
        { sale: { product: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    } : {}),
  };

  const [list, bankAccounts, statusCounts] = await Promise.all([
    prisma.commission.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
      include: {
        payee: { select: { name: true } },
        sale: {
          select: {
            saleDate: true, netAmount: true,
            customer: { select: { name: true } },
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.commission.groupBy({ by: ["status"], where: { deletedAt: null, ...scope }, _count: true, _sum: { amount: true } }),
  ]);

  const totalLiberada = Number(statusCounts.find(s => s.status === "LIBERADA")?._sum.amount ?? 0);
  const totalPaga = Number(statusCounts.find(s => s.status === "PAGA")?._sum.amount ?? 0);
  const totalPendente = Number(statusCounts.find(s => s.status === "PENDENTE")?._sum.amount ?? 0);

  const opt = (xs: { id: string; name: string }[]): Opt[] => xs.map((x) => ({ id: x.id, name: x.name }));

  type Row = (typeof list)[number];
  const columns: Column<Row>[] = [
    { header: "Data venda", cell: (r) => <span className="text-xs text-ink-muted">{dateBR(r.sale.saleDate)}</span>, width: "100px" },
    {
      header: "Beneficiário",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.payee.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.sale.customer.name} · {r.sale.product.name}</div>
        </div>
      ),
    },
    { header: "% sobre", cell: (r) => <span className="text-ink-muted">{pct(Number(r.percent))} <span className="text-ink-subtle">{r.base.toLowerCase()}</span></span>, width: "120px" },
    {
      header: "Valor",
      cell: (r) => (
        <div className="text-right">
          <div className="text-ink font-medium">{brl(r.amount)}</div>
          <div className="text-xs text-ink-subtle">venda {brl(r.sale.netAmount)}</div>
        </div>
      ),
      width: "140px",
      className: "text-right",
    },
    { header: "Status", cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{commissionStatusLabel[r.status]}</span>, width: "120px" },
    { header: "Pago em", cell: (r) => <span className="text-xs text-ink-muted">{dateBR(r.paidAt)}</span>, width: "110px" },
    {
      header: "",
      cell: (r) => (
        <CommissionActions
          row={{ id: r.id, payeeName: r.payee.name, amount: r.amount.toString(), status: r.status } satisfies CommissionQuick}
          bankAccounts={opt(bankAccounts)}
        />
      ),
      className: "text-right",
      width: "140px",
    },
  ];

  const filters = [
    { label: "Todas", value: "", count: list.length },
    ...Object.entries(commissionStatusLabel).map(([v, l]) => {
      const c = statusCounts.find((x) => x.status === v);
      return { label: l, value: v, count: c?._count ?? 0 };
    }),
  ];

  return (
    <PageShell
      title="Comissões"
      description="Comissões de vendedores, consultores e parceiros. Liberadas após confirmação do pagamento do cliente."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi"><p className="kpi-label">A pagar (liberadas)</p><p className="mt-2 text-2xl font-semibold text-warn">{brl(totalLiberada)}</p></div>
        <div className="kpi"><p className="kpi-label">Pendentes (aguardando pgto. cliente)</p><p className="mt-2 text-2xl font-semibold text-info">{brl(totalPendente)}</p></div>
        <div className="kpi"><p className="kpi-label">Pagas no histórico</p><p className="mt-2 text-2xl font-semibold text-ok">{brl(totalPaga)}</p></div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar beneficiário, cliente ou produto…" />
        <div className="text-sm text-ink-muted">{list.length} comissões na consulta</div>
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
      <DataTable rows={list as Row[]} columns={columns} emptyTitle="Nenhuma comissão registrada" emptyDescription="Comissões são criadas automaticamente ao cadastrar venda com vendedor e % > 0." />
    </PageShell>
  );
}
