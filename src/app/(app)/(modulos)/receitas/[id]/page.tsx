import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, User, Package, Wallet, Tag, FileText, Receipt, Link2, Clock, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { isSellerOnly } from "@/lib/scopes";
import { PageShell } from "@/components/layout/page-shell";
import { brl, dateBR, dateTimeBR } from "@/lib/format";
import { saleValidationStatusBadge, saleValidationStatusLabel, saleStatusLabel, saleOriginLabel } from "@/lib/validations";
import { ValidationActions, ValidationAnalysis } from "./_components/actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true, product: true,
      seller: { select: { name: true } }, sdr: { select: { name: true } },
      submittedBy: { select: { name: true } }, validatedBy: { select: { name: true } },
      paymentMethod: { select: { name: true } },
      installments: { orderBy: { number: "asc" } },
      commissions: { include: { payee: { select: { name: true } } } },
    },
  });
  if (!sale) notFound();

  // Comercial só vê se for dele
  if (isSellerOnly(session.user.role) && sale.sellerId !== session.user.id && sale.submittedById !== session.user.id) notFound();

  const isFinancial = session.user.role === "ADMIN" || session.user.role === "FINANCEIRO";
  const auditLogs = await prisma.auditLog.findMany({
    where: { entity: "Sale", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { name: true } } },
  });

  return (
    <PageShell
      title={`Venda — ${sale.customer.name}`}
      description={`${sale.product.name} · lançada em ${dateTimeBR(sale.createdAt)} por ${sale.submittedBy?.name ?? "—"}`}
    >
      <div className="flex items-center justify-between">
        <Link href="/receitas" className="btn-ghost text-sm">
          <ArrowLeft className="h-4 w-4" /> Receitas
        </Link>
        <span className={"badge " + (saleValidationStatusBadge[sale.validationStatus] ?? "badge-muted")}>{saleValidationStatusLabel[sale.validationStatus]}</span>
      </div>

      {sale.validationStatus === "PENDING_VALIDATION" && isFinancial && (
        <>
          <ValidationAnalysis saleId={sale.id} customerId={sale.customerId} productId={sale.productId} netAmount={Number(sale.netAmount)} saleDate={sale.saleDate.toISOString()} receiptUrl={sale.receiptUrl ?? undefined} contractUrl={sale.contractUrl ?? undefined} />
          <ValidationActions saleId={sale.id} />
        </>
      )}

      {sale.validationStatus === "NEEDS_ADJUSTMENT" && sale.adjustmentReason && (
        <div className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Ajuste solicitado</p>
            <p className="mt-1">{sale.adjustmentReason}</p>
          </div>
        </div>
      )}

      {sale.validationStatus === "REJECTED" && sale.rejectedReason && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Venda reprovada</p>
            <p className="mt-1">{sale.rejectedReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-ink">Resumo financeiro</h3>
          <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Valor bruto" value={brl(sale.grossAmount)} />
          <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Descontos" value={brl(sale.discountAmount)} />
          <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Taxas" value={brl(sale.feeAmount)} />
          <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Líquido" value={brl(sale.netAmount)} highlight />
          {sale.entryAmount && <Row icon={<Wallet className="h-3.5 w-3.5" />} label="Entrada" value={brl(sale.entryAmount)} />}
          <Row icon={<Receipt className="h-3.5 w-3.5" />} label="Parcelas" value={sale.installmentsCount.toString()} />
          <Row icon={<Tag className="h-3.5 w-3.5" />} label="Forma de pagamento" value={sale.paymentMethod?.name ?? "—"} />
          <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Data da venda" value={dateBR(sale.saleDate)} />
          <Row icon={<Calendar className="h-3.5 w-3.5" />} label="1º vencimento" value={dateBR(sale.firstDueDate)} />
          <Row icon={<Tag className="h-3.5 w-3.5" />} label="Status financeiro" value={saleStatusLabel[sale.status] ?? sale.status} />
        </div>

        <div className="card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-ink">Cliente e comercial</h3>
          <Row icon={<User className="h-3.5 w-3.5" />} label="Cliente" value={sale.customer.name} />
          <Row icon={<User className="h-3.5 w-3.5" />} label="Email/CPF" value={`${sale.customer.email ?? "—"} · ${sale.customer.document ?? "—"}`} />
          <Row icon={<Package className="h-3.5 w-3.5" />} label="Produto" value={sale.product.name} />
          <Row icon={<User className="h-3.5 w-3.5" />} label="Vendedor" value={sale.seller?.name ?? "—"} />
          <Row icon={<User className="h-3.5 w-3.5" />} label="SDR" value={sale.sdr?.name ?? "—"} />
          <Row icon={<Tag className="h-3.5 w-3.5" />} label="Origem" value={saleOriginLabel[sale.origin] ?? sale.origin} />
          {sale.campaign && <Row icon={<Tag className="h-3.5 w-3.5" />} label="Campanha" value={sale.campaign} />}
          {sale.cohort && <Row icon={<Tag className="h-3.5 w-3.5" />} label="Turma/Cohort" value={sale.cohort} />}
          {sale.crmLink && <Row icon={<Link2 className="h-3.5 w-3.5" />} label="CRM" value={<a href={sale.crmLink} target="_blank" rel="noopener noreferrer" className="text-magenta-400 underline">Abrir</a>} />}
          {sale.receiptUrl && <Row icon={<FileText className="h-3.5 w-3.5" />} label="Comprovante" value={<a href={sale.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-magenta-400 underline">Ver</a>} />}
          {sale.contractUrl && <Row icon={<FileText className="h-3.5 w-3.5" />} label="Contrato" value={<a href={sale.contractUrl} target="_blank" rel="noopener noreferrer" className="text-magenta-400 underline">Ver</a>} />}
        </div>
      </div>

      {sale.notes && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-ink">Observações</h3>
          <p className="mt-2 text-sm text-ink-muted whitespace-pre-line">{sale.notes}</p>
        </div>
      )}

      {sale.installments.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Vencimento</th><th className="text-right">Valor</th><th className="text-right">Pago</th><th>Status</th></tr></thead>
            <tbody>
              {sale.installments.map((i) => (
                <tr key={i.id}>
                  <td className="text-ink-muted">{i.number}/{sale.installmentsCount}</td>
                  <td>{dateBR(i.dueDate)}</td>
                  <td className="text-right text-ink">{brl(i.amount)}</td>
                  <td className="text-right text-ok">{brl(i.paidAmount)}</td>
                  <td><span className="badge-muted">{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2"><Clock className="h-4 w-4" /> Histórico de auditoria</h3>
        <ul className="mt-3 space-y-2">
          {auditLogs.length === 0 && <li className="text-sm text-ink-muted">Sem registros.</li>}
          {auditLogs.map((l) => (
            <li key={l.id} className="text-xs flex items-center gap-3 border-b border-line/60 pb-2">
              <span className="text-ink-subtle whitespace-nowrap">{dateTimeBR(l.createdAt)}</span>
              <span className="text-ink-muted">{l.user?.name ?? "Sistema"}</span>
              <span className="badge-muted">{l.action}</span>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}

function Row({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wider text-ink-subtle flex items-center gap-1.5">{icon}{label}</dt>
      <dd className={highlight ? "text-ink font-semibold" : "text-ink"}>{value}</dd>
    </div>
  );
}
