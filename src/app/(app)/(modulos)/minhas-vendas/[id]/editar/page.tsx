import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageShell } from "@/components/layout/page-shell";
import { brl } from "@/lib/format";
import { EditSaleForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { customer: { select: { name: true, email: true, document: true, status: true } }, product: { select: { name: true } } },
  });
  if (!sale) notFound();

  const isOwner = sale.submittedById === session.user.id || sale.sellerId === session.user.id;
  const isFinancial = session.user.role === "ADMIN" || session.user.role === "FINANCEIRO";
  if (!isOwner && !isFinancial) redirect("/minhas-vendas");

  const canEdit = isFinancial || (sale.validationStatus === "PENDING_VALIDATION" || sale.validationStatus === "NEEDS_ADJUSTMENT");

  const [products, paymentMethods] = await Promise.all([
    prisma.product.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <PageShell
      title={`Editar venda — ${sale.customer.name}`}
      description={`${sale.product.name} · ${brl(sale.netAmount)}`}
    >
      <Link href="/minhas-vendas" className="btn-ghost text-sm">
        <ArrowLeft className="h-4 w-4" /> Minhas vendas
      </Link>

      {sale.validationStatus === "NEEDS_ADJUSTMENT" && sale.adjustmentReason && (
        <div className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Financeiro solicitou ajuste</p>
            <p className="mt-1">{sale.adjustmentReason}</p>
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
          Esta venda já foi validada. Pra corrigir, solicite ajuste ao financeiro.
        </div>
      )}

      {canEdit && (
        <EditSaleForm
          sale={{
            id: sale.id, productId: sale.productId, paymentMethodId: sale.paymentMethodId,
            grossAmount: sale.grossAmount.toString(), feeAmount: sale.feeAmount.toString(),
            installmentsCount: sale.installmentsCount, cohort: sale.cohort, campaign: sale.campaign,
            crmLink: sale.crmLink, receiptUrl: sale.receiptUrl, contractUrl: sale.contractUrl, notes: sale.notes,
            validationStatus: sale.validationStatus,
          }}
          products={products} paymentMethods={paymentMethods}
        />
      )}
    </PageShell>
  );
}
