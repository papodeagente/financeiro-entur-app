import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { ReconcileButton, type ReconcileRow, type Opt } from "./_components/reconcile-drawer";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  NAO_CONCILIADO: "badge-info",
  CONCILIADO: "badge-ok",
  DIVERGENTE: "badge-danger",
  PENDENTE_CONFERENCIA: "badge-warn",
};
const statusLabel: Record<string, string> = {
  NAO_CONCILIADO: "Não conciliado",
  CONCILIADO: "Conciliado",
  DIVERGENTE: "Divergente",
  PENDENTE_CONFERENCIA: "Pendente conferência",
};

type Filter = "todas" | "nao-conciliadas" | "conciliadas" | "divergentes";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; filter?: Filter }> }) {
  const { q, filter = "nao-conciliadas" } = await searchParams;

  const baseWhere = {
    deletedAt: null,
    status: "PAGO" as const,
    ...(q ? { sale: { OR: [
      { customer: { name: { contains: q, mode: "insensitive" as const } } },
      { product: { name: { contains: q, mode: "insensitive" as const } } },
    ]}} : {}),
  };

  const recWhere = (() => {
    switch (filter) {
      case "conciliadas": return { reconciliation: { status: "CONCILIADO" as const } };
      case "divergentes": return { reconciliation: { status: "DIVERGENTE" as const } };
      case "nao-conciliadas": return { reconciliation: { is: null } };
      default: return {};
    }
  })();

  const [list, bankAccounts, totals] = await Promise.all([
    prisma.revenueInstallment.findMany({
      where: { ...baseWhere, ...recWhere },
      orderBy: { paidAt: "desc" },
      take: 200,
      include: {
        sale: { select: { customer: { select: { name: true } }, product: { select: { name: true } } } },
        bankAccount: { select: { name: true } },
        reconciliation: true,
      },
    }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    (async () => {
      const [totalPaid, totalRec, totalDiv, totalUnrec] = await Promise.all([
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: "PAGO" } }),
        prisma.reconciliation.count({ where: { status: "CONCILIADO" } }),
        prisma.reconciliation.count({ where: { status: "DIVERGENTE" } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: "PAGO", reconciliation: { is: null } } }),
      ]);
      return { totalPaid, totalRec, totalDiv, totalUnrec };
    })(),
  ]);

  const opt: Opt[] = bankAccounts.map((b) => ({ id: b.id, name: b.name }));

  type Row = (typeof list)[number];
  const columns: Column<Row>[] = [
    {
      header: "Recebimento",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.sale.customer.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.sale.product.name} · pago em {dateBR(r.paidAt)}</div>
        </div>
      ),
    },
    { header: "Bruto", cell: (r) => <span className="text-ink">{brl(r.amount)}</span>, width: "120px", className: "text-right" },
    {
      header: "Taxas",
      cell: (r) => r.reconciliation ? <span className="text-warn">{brl(Number(r.reconciliation.platformFee) + Number(r.reconciliation.gatewayFee))}</span> : <span className="text-ink-subtle">—</span>,
      width: "120px", className: "text-right",
    },
    {
      header: "Líquido",
      cell: (r) => r.reconciliation ? <span className="font-medium text-ok">{brl(r.reconciliation.netAmount)}</span> : <span className="text-ink-subtle">—</span>,
      width: "140px", className: "text-right",
    },
    { header: "Conta", cell: (r) => <span className="text-ink-muted text-xs">{r.bankAccount?.name ?? "—"}</span>, width: "160px" },
    {
      header: "Status",
      cell: (r) => r.reconciliation ? <span className={statusBadge[r.reconciliation.status]}>{statusLabel[r.reconciliation.status]}</span> : <span className="badge-info">Não conciliado</span>,
      width: "180px",
    },
    {
      header: "",
      cell: (r) => (
        <ReconcileButton
          row={{
            installmentId: r.id,
            grossAmount: r.amount.toString(),
            paidAmount: r.paidAmount.toString(),
            description: `${r.sale.customer.name} · ${r.sale.product.name}`,
            existing: r.reconciliation ? {
              platformFee: r.reconciliation.platformFee.toString(),
              gatewayFee: r.reconciliation.gatewayFee.toString(),
              netAmount: r.reconciliation.netAmount.toString(),
              receivedAt: r.reconciliation.receivedAt.toISOString(),
              bankAccountId: r.reconciliation.bankAccountId,
              notes: r.reconciliation.notes,
              status: r.reconciliation.status,
            } : null,
          } satisfies ReconcileRow}
          bankAccounts={opt}
        />
      ),
      className: "text-right",
      width: "140px",
    },
  ];

  const filters: { label: string; value: Filter; count: number }[] = [
    { label: "Não conciliadas", value: "nao-conciliadas", count: totals.totalUnrec },
    { label: "Conciliadas", value: "conciliadas", count: totals.totalRec },
    { label: "Divergentes", value: "divergentes", count: totals.totalDiv },
    { label: "Todas pagas", value: "todas", count: totals.totalPaid },
  ];

  return (
    <PageShell
      title="Conciliação financeira"
      description="Compara o valor da venda (bruto) com taxas da plataforma/gateway e o líquido efetivamente recebido na conta."
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Kpi label="Pagas no histórico" value={totals.totalPaid.toString()} />
        <Kpi label="Conciliadas" value={totals.totalRec.toString()} tone="ok" />
        <Kpi label="Divergentes" value={totals.totalDiv.toString()} tone="danger" />
        <Kpi label="Pendentes de conciliação" value={totals.totalUnrec.toString()} tone="info" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar cliente ou produto…" />
        <div className="text-sm text-ink-muted">{list.length} parcelas na consulta</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const params = new URLSearchParams();
          params.set("filter", f.value);
          if (q) params.set("q", q);
          const active = filter === f.value;
          return (
            <a key={f.value} href={`?${params.toString()}`}
              className={"rounded-full px-3 py-1 text-xs ring-1 " + (active ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-bg-elev text-ink-muted ring-line hover:text-ink")}>
              {f.label} <span className="text-ink-subtle ml-1">{f.count}</span>
            </a>
          );
        })}
      </div>
      <DataTable
        rows={list as Row[]}
        columns={columns}
        emptyTitle="Nada para conciliar"
        emptyDescription="Quando parcelas forem marcadas como pagas, aparecem aqui prontas pra você lançar taxa de plataforma, gateway e líquido."
      />
    </PageShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" | "info" }) {
  const cls = tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : tone === "info" ? "text-info" : "text-ink";
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className={"mt-2 text-2xl font-semibold " + cls}>{value}</p>
    </div>
  );
}
