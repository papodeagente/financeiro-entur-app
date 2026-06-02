import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { brl, dateBR } from "@/lib/format";
import { expenseStatusLabel } from "@/lib/validations";
import { syncOverdueExpenses } from "@/lib/finance-ops";
import { daysOverdue } from "@/lib/dates";
import { PayActions, type ExpenseQuickPay, type Opt } from "./_components/row-actions";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  PENDENTE: "badge-info", PAGO: "badge-ok", VENCIDO: "badge-danger",
  CANCELADO: "badge-muted", AGENDADO: "badge-warn",
};

type Filter = "abertas" | "vencidas" | "hoje" | "proximos7" | "proximos30" | "agendadas" | "pagas" | "todas";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; filter?: Filter }> }) {
  const { q, filter = "abertas" } = await searchParams;
  await syncOverdueExpenses();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

  const filters: Record<Filter, object> = {
    todas: {},
    abertas: { status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] } },
    vencidas: { status: "VENCIDO" },
    hoje: { status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: tomorrow } },
    proximos7: { status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: in7 } },
    proximos30: { status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: in30 } },
    agendadas: { status: "AGENDADO" },
    pagas: { status: "PAGO" },
  };

  const where = {
    deletedAt: null,
    ...filters[filter],
    ...(q ? { OR: [
      { description: { contains: q, mode: "insensitive" as const } },
      { supplier: { name: { contains: q, mode: "insensitive" as const } } },
    ]} : {}),
  };

  const [list, bankAccounts, paymentMethods, counters] = await Promise.all([
    prisma.expense.findMany({
      where, orderBy: { dueDate: "asc" }, take: 300,
      include: {
        supplier: { select: { name: true } },
        category: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
    }),
    prisma.bankAccount.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    (async () => {
      const [todas, abertas, vencidas, hoje, p7, p30, agendadas, pagas] = await Promise.all([
        prisma.expense.count({ where: { deletedAt: null } }),
        prisma.expense.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] } } }),
        prisma.expense.count({ where: { deletedAt: null, status: "VENCIDO" } }),
        prisma.expense.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: tomorrow } } }),
        prisma.expense.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: in7 } } }),
        prisma.expense.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: in30 } } }),
        prisma.expense.count({ where: { deletedAt: null, status: "AGENDADO" } }),
        prisma.expense.count({ where: { deletedAt: null, status: "PAGO" } }),
      ]);
      return { todas, abertas, vencidas, hoje, proximos7: p7, proximos30: p30, agendadas, pagas };
    })(),
  ]);

  const totalOpen = list.filter(e => ["PENDENTE", "VENCIDO", "AGENDADO"].includes(e.status)).reduce((a, e) => a + Number(e.amount), 0);

  const opt = (xs: { id: string; name: string }[]): Opt[] => xs.map((x) => ({ id: x.id, name: x.name }));

  type Row = (typeof list)[number];
  const columns: Column<Row>[] = [
    {
      header: "Descrição / Fornecedor",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.description}</div>
          <div className="text-xs text-ink-subtle mt-0.5">
            {r.supplier?.name ?? "Sem fornecedor"}
            {r.category && <> · {r.category.name}</>}
            {r.costCenter && <> · {r.costCenter.name}</>}
          </div>
        </div>
      ),
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
    { header: "Valor", cell: (r) => <span className="font-medium text-ink">{brl(r.amount)}</span>, width: "140px", className: "text-right" },
    { header: "Status", cell: (r) => <span className={statusBadge[r.status] ?? "badge-muted"}>{expenseStatusLabel[r.status]}</span>, width: "120px" },
    {
      header: "",
      cell: (r) => (r.status !== "PAGO" && r.status !== "CANCELADO") ? (
        <PayActions
          row={{ id: r.id, description: r.description, amount: r.amount.toString(), bankAccountId: r.bankAccountId, paymentMethodId: r.paymentMethodId, attachmentUrl: r.attachmentUrl } satisfies ExpenseQuickPay}
          bankAccounts={opt(bankAccounts)} paymentMethods={opt(paymentMethods)}
        />
      ) : r.attachmentUrl ? <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5 inline-flex justify-end" title="Comprovante">📎</a> : null,
      className: "text-right",
      width: "140px",
    },
  ];

  const filterChips: { label: string; value: Filter; count: number }[] = [
    { label: "Em aberto", value: "abertas", count: counters.abertas },
    { label: "Vencidas", value: "vencidas", count: counters.vencidas },
    { label: "Hoje", value: "hoje", count: counters.hoje },
    { label: "Próx. 7d", value: "proximos7", count: counters.proximos7 },
    { label: "Próx. 30d", value: "proximos30", count: counters.proximos30 },
    { label: "Agendadas", value: "agendadas", count: counters.agendadas },
    { label: "Pagas", value: "pagas", count: counters.pagas },
    { label: "Todas", value: "todas", count: counters.todas },
  ];

  return (
    <PageShell
      title="Contas a pagar"
      description="Pagamentos pendentes, agendados e em atraso."
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar despesa ou fornecedor…" />
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
      <DataTable rows={list as Row[]} columns={columns} emptyTitle="Nenhuma despesa neste filtro" emptyDescription="Cadastre despesas em /despesas para gerenciar pagamentos aqui." />
    </PageShell>
  );
}
