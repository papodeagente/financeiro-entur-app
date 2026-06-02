import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { installmentStatusLabel } from "@/lib/validations";
import { syncOverdueInstallments } from "@/lib/finance-ops";
import { daysOverdue } from "@/lib/dates";
import { RowActions, type InstallmentRowAction, type Opt } from "./_components/row-actions";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  PENDENTE: "badge-info",
  PARCIALMENTE_PAGO: "badge-warn",
  PAGO: "badge-ok",
  VENCIDO: "badge-danger",
  EM_NEGOCIACAO: "badge-warn",
  CANCELADO: "badge-muted",
  REEMBOLSADO: "badge-muted",
  CHARGEBACK: "badge-danger",
};

type Filter = "todas" | "vencidas" | "hoje" | "proximos7" | "proximos30" | "pagas" | "abertas";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; filter?: Filter }> }) {
  await requireRole(["ADMIN", "FINANCEIRO", "GESTOR"]);
  const { q, filter = "abertas" } = await searchParams;

  // Antes de listar, sincroniza status vencidos
  await syncOverdueInstallments();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const filters: Record<Filter, object> = {
    todas: {},
    vencidas: { status: "VENCIDO" },
    hoje: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] }, dueDate: { gte: today, lt: tomorrow } },
    proximos7: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] }, dueDate: { gte: today, lt: in7 } },
    proximos30: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] }, dueDate: { gte: today, lt: in30 } },
    pagas: { status: "PAGO" },
    abertas: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] } },
  };

  const where = {
    deletedAt: null,
    ...filters[filter],
    ...(q ? { sale: { OR: [
      { customer: { name: { contains: q, mode: "insensitive" as const } } },
      { product: { name: { contains: q, mode: "insensitive" as const } } },
    ]}} : {}),
  };

  const [installments, bankAccounts, paymentMethods, counters] = await Promise.all([
    prisma.revenueInstallment.findMany({
      where,
      orderBy: { dueDate: "asc" },
      take: 200,
      include: {
        sale: {
          select: {
            id: true, installmentsCount: true,
            customer: { select: { name: true } },
            product: { select: { name: true } },
            seller: { select: { name: true } },
          },
        },
        paymentMethod: { select: { name: true } },
        bankAccount: { select: { name: true } },
      },
    }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    (async () => {
      const [todas, vencidas, hoje, p7, p30, pagas, abertas] = await Promise.all([
        prisma.revenueInstallment.count({ where: { deletedAt: null } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: "VENCIDO" } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] }, dueDate: { gte: today, lt: tomorrow } } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] }, dueDate: { gte: today, lt: in7 } } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] }, dueDate: { gte: today, lt: in30 } } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: "PAGO" } }),
        prisma.revenueInstallment.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] } } }),
      ]);
      return { todas, vencidas, hoje, proximos7: p7, proximos30: p30, pagas, abertas };
    })(),
  ]);

  const totalOpen = installments
    .filter((i) => ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"].includes(i.status))
    .reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount)), 0);

  const bankOpts: Opt[] = bankAccounts.map((b) => ({ id: b.id, name: b.name }));
  const pmOpts: Opt[] = paymentMethods.map((p) => ({ id: p.id, name: p.name }));

  type Row = (typeof installments)[number];
  const columns: Column<Row>[] = [
    {
      header: "Cliente / Produto",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.sale.customer.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.sale.product.name}</div>
        </div>
      ),
    },
    {
      header: "Parcela",
      cell: (r) => <span className="text-ink-muted text-xs">{r.number}/{r.sale.installmentsCount}</span>,
      width: "90px",
      className: "text-center",
    },
    {
      header: "Valor",
      cell: (r) => {
        const total = Number(r.amount);
        const paid = Number(r.paidAmount);
        const open = total - paid;
        return (
          <div className="text-right">
            <div className="text-ink font-medium">{brl(total)}</div>
            {paid > 0 && paid < total && <div className="text-xs text-warn">Restante {brl(open)}</div>}
          </div>
        );
      },
      width: "140px",
      className: "text-right",
    },
    {
      header: "Vencimento",
      cell: (r) => {
        const d = daysOverdue(r.dueDate);
        return (
          <div>
            <div className="text-ink text-xs">{dateBR(r.dueDate)}</div>
            {d > 0 && r.status !== "PAGO" && r.status !== "CANCELADO" && (
              <div className="text-xs text-danger mt-0.5">{d} dia{d > 1 ? "s" : ""} em atraso</div>
            )}
          </div>
        );
      },
      width: "140px",
    },
    { header: "Status", cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{installmentStatusLabel[r.status]}</span>, width: "140px" },
    { header: "Forma", cell: (r) => <span className="text-ink-muted text-xs">{r.paymentMethod?.name ?? "—"}</span>, width: "140px" },
    {
      header: "",
      cell: (r) => (
        <RowActions
          row={{
            id: r.id, amount: r.amount.toString(), paidAmount: r.paidAmount.toString(),
            number: r.number, totalInstallments: r.sale.installmentsCount,
            bankAccountId: r.bankAccountId, paymentMethodId: r.paymentMethodId,
            dueDate: r.dueDate.toISOString(), customerName: r.sale.customer.name,
          } satisfies InstallmentRowAction}
          bankAccounts={bankOpts}
          paymentMethods={pmOpts}
        />
      ),
      className: "text-right",
      width: "180px",
    },
  ];

  const filterChips: { label: string; value: Filter; count: number }[] = [
    { label: "Em aberto", value: "abertas", count: counters.abertas },
    { label: "Vencidas", value: "vencidas", count: counters.vencidas },
    { label: "Hoje", value: "hoje", count: counters.hoje },
    { label: "Próx. 7d", value: "proximos7", count: counters.proximos7 },
    { label: "Próx. 30d", value: "proximos30", count: counters.proximos30 },
    { label: "Pagas", value: "pagas", count: counters.pagas },
    { label: "Todas", value: "todas", count: counters.todas },
  ];

  return (
    <PageShell
      title="Contas a receber"
      description="Parcelas, mensalidades e recebíveis futuros. Marque como pago para creditar na conta bancária e liberar comissões."
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar cliente ou produto…" />
        <div className="text-sm text-ink-muted">
          Total em aberto na consulta: <span className="text-ink font-medium">{brl(totalOpen)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filterChips.map((f) => {
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
        rows={installments as Row[]}
        columns={columns}
        emptyTitle="Nenhuma parcela neste filtro"
        emptyDescription="Cadastre uma venda em Receitas para gerar parcelas automaticamente."
      />
    </PageShell>
  );
}
