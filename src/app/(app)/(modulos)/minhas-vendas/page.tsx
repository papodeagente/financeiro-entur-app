import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { brl, dateBR, pct, relTime } from "@/lib/format";
import { saleValidationStatusBadge, saleValidationStatusLabel } from "@/lib/validations";
import { ofMonth } from "@/lib/period";
import { Plus, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

export default async function Page() {
  const session = await requireSession();
  const userId = session.user.id;
  const p = ofMonth(new Date().getFullYear(), new Date().getMonth() + 1);

  const [sales, statusCounts, goalRow, commissions] = await Promise.all([
    prisma.sale.findMany({
      where: {
        deletedAt: null,
        OR: [{ submittedById: userId }, { sellerId: userId }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.sale.groupBy({
      by: ["validationStatus"],
      where: {
        deletedAt: null,
        OR: [{ submittedById: userId }, { sellerId: userId }],
        createdAt: { gte: p.start, lt: p.end },
      },
      _count: true,
      _sum: { netAmount: true },
    }),
    prisma.salesGoal.findUnique({
      where: { userId_year_month: { userId, year: p.year, month: p.month ?? 1 } },
    }),
    prisma.commission.aggregate({
      _sum: { amount: true }, _count: true,
      where: { payeeId: userId, status: { in: ["PENDENTE", "LIBERADA"] } },
    }),
  ]);

  const countOf = (s: string) => statusCounts.find((x) => x.validationStatus === s);
  const pending = countOf("PENDING_VALIDATION");
  const validated = countOf("VALIDATED");
  const rejected = countOf("REJECTED");
  const adjustment = countOf("NEEDS_ADJUSTMENT");
  const submittedTotal = statusCounts.reduce((a, x) => a + x._count, 0);
  const submittedValue = statusCounts.reduce((a, x) => a + num(x._sum.netAmount), 0);
  const validatedValue = num(validated?._sum.netAmount);

  const goalAmount = num(goalRow?.targetAmount);
  const attainment = goalAmount > 0 ? (validatedValue / goalAmount) * 100 : null;

  const commissionExpected = num(commissions._sum.amount);

  type Row = (typeof sales)[number];
  const columns: Column<Row>[] = [
    { header: "Quando", cell: (r) => <span className="text-xs text-ink-subtle">{relTime(r.createdAt)}</span>, width: "140px" },
    {
      header: "Cliente / Produto",
      cell: (r) => (
        <div>
          <div className="text-ink font-medium">{r.customer.name}</div>
          <div className="text-xs text-ink-subtle mt-0.5">{r.product.name}</div>
        </div>
      ),
    },
    {
      header: "Valor",
      cell: (r) => (
        <div className="text-right">
          <div className="text-ink font-medium">{brl(r.netAmount)}</div>
          <div className="text-xs text-ink-subtle">{r.installmentsCount > 1 ? `${r.installmentsCount}× ${brl(Number(r.netAmount) / r.installmentsCount)}` : "à vista"}</div>
        </div>
      ),
      width: "160px",
      className: "text-right",
    },
    {
      header: "Status",
      cell: (r) => (
        <div>
          <span className={saleValidationStatusBadge[r.validationStatus] ?? "badge-muted"}>{saleValidationStatusLabel[r.validationStatus]}</span>
          {r.adjustmentReason && r.validationStatus === "NEEDS_ADJUSTMENT" && (
            <p className="mt-1 text-[11px] text-warn">Ajuste: {r.adjustmentReason}</p>
          )}
          {r.rejectedReason && r.validationStatus === "REJECTED" && (
            <p className="mt-1 text-[11px] text-danger">Motivo: {r.rejectedReason}</p>
          )}
        </div>
      ),
      width: "240px",
    },
    {
      header: "Próxima ação",
      cell: (r) => {
        if (r.validationStatus === "NEEDS_ADJUSTMENT") {
          return <Link href={`/minhas-vendas/${r.id}/editar`} className="text-magenta-400 text-xs">Corrigir agora →</Link>;
        }
        if (r.validationStatus === "PENDING_VALIDATION" && (!r.receiptUrl)) {
          return <Link href={`/minhas-vendas/${r.id}/editar`} className="text-warn text-xs">Anexar comprovante →</Link>;
        }
        if (r.validationStatus === "PENDING_VALIDATION") {
          return <span className="text-xs text-ink-subtle">Aguardando financeiro</span>;
        }
        if (r.validationStatus === "VALIDATED") return <span className="text-xs text-ok">Tudo certo</span>;
        if (r.validationStatus === "REJECTED" || r.validationStatus === "DUPLICATED") return <span className="text-xs text-ink-subtle">—</span>;
        return null;
      },
      width: "200px",
    },
    {
      header: "",
      cell: (r) => <Link href={`/minhas-vendas/${r.id}/editar`} className="btn-ghost p-1.5 inline-flex"><ChevronRight className="h-3.5 w-3.5" /></Link>,
      className: "text-right",
      width: "60px",
    },
  ];

  return (
    <PageShell
      title="Minhas vendas"
      description={`${p.label} · ${submittedTotal} venda${submittedTotal !== 1 ? "s" : ""} lançada${submittedTotal !== 1 ? "s" : ""}.`}
      actions={
        <Link href="/minhas-vendas/nova" className="btn-primary">
          <Plus className="h-4 w-4" /> Lançar venda
        </Link>
      }
    >
      {/* Meta */}
      {goalRow ? (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-ink">Meta do mês</h3>
              <p className="text-xs text-ink-muted">{brl(validatedValue)} validados de {brl(goalAmount)}</p>
            </div>
            <div className="text-right">
              <p className={"text-3xl font-bold " + ((attainment ?? 0) >= 100 ? "text-ok" : (attainment ?? 0) >= 70 ? "text-warn" : "text-danger")}>
                {attainment !== null ? pct(attainment) : "—"}
              </p>
              <p className="text-[11px] text-ink-subtle uppercase tracking-widest">atingimento</p>
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-bg-elev overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, attainment ?? 0)}%`, background: "linear-gradient(90deg, #8B33F2, #FF1AB5)" }} />
          </div>
          <p className="mt-2 text-xs text-ink-subtle">⚠ Meta considera apenas vendas <strong className="text-ink">validadas</strong> pelo financeiro. Venda em validação não conta.</p>
        </div>
      ) : (
        <div className="card-soft p-4 text-sm text-ink-muted">Você não tem meta pra {p.label}. Peça pro gestor cadastrar em Configurações → Metas.</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Lançadas no mês" value={submittedTotal.toString()} subValue={brl(submittedValue)} />
        <Kpi label="Aguardando validação" value={(pending?._count ?? 0).toString()} subValue={brl(num(pending?._sum.netAmount))} tone="warn" icon={<Clock className="h-4 w-4" />} />
        <Kpi label="Validadas" value={(validated?._count ?? 0).toString()} subValue={brl(validatedValue)} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="Ajuste solicitado" value={(adjustment?._count ?? 0).toString()} tone="info" icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi label="Reprovadas" value={(rejected?._count ?? 0).toString()} tone="danger" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Kpi label="Comissão prevista (aguardando + liberada)" value={brl(commissionExpected)} subValue={`${commissions._count} comiss${commissions._count === 1 ? "ão" : "ões"}`} />
        <div className="kpi">
          <p className="kpi-label">Próximos passos</p>
          <ul className="mt-2 text-sm text-ink-muted space-y-1">
            {(adjustment?._count ?? 0) > 0 && <li className="text-warn">• Corrija {adjustment?._count} venda{(adjustment?._count ?? 0) > 1 ? "s" : ""} com ajuste pendente</li>}
            {(pending?._count ?? 0) > 0 && <li>• {pending?._count} venda{(pending?._count ?? 0) > 1 ? "s" : ""} aguardando financeiro</li>}
            {(rejected?._count ?? 0) > 0 && <li className="text-danger">• {rejected?._count} venda{(rejected?._count ?? 0) > 1 ? "s" : ""} reprovada{(rejected?._count ?? 0) > 1 ? "s" : ""} no mês</li>}
            {!adjustment && !pending && <li className="text-ok">• Tudo em dia</li>}
          </ul>
        </div>
      </div>

      <DataTable
        rows={sales as Row[]}
        columns={columns}
        emptyTitle="Você ainda não lançou nenhuma venda"
        emptyDescription="Clique em 'Lançar venda' pra começar."
      />
    </PageShell>
  );
}

type Tone = "ok" | "warn" | "danger" | "info" | "brand";
const toneCls: Record<Tone, string> = {
  ok: "ring-ok/30 bg-ok/10 text-ok",
  warn: "ring-warn/30 bg-warn/10 text-warn",
  danger: "ring-danger/30 bg-danger/10 text-danger",
  info: "ring-info/30 bg-info/10 text-info",
  brand: "ring-brand-500/30 bg-brand-soft text-magenta-400",
};

function Kpi({ label, value, subValue, tone = "brand", icon }: { label: string; value: string; subValue?: string; tone?: Tone; icon?: React.ReactNode }) {
  return (
    <div className="kpi">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-md ring-1 ${toneCls[tone]}`}>{icon}</span>}
      </div>
      <p className="kpi-value">{value}</p>
      {subValue && <p className="mt-1 text-xs text-ink-subtle">{subValue}</p>}
    </div>
  );
}
