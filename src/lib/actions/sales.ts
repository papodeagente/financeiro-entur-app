"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { saleSchema, refundSchema, chargebackSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { addMonths } from "@/lib/dates";
import { recomputeCustomerStatus } from "@/lib/finance-ops";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createSale(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireWrite();
  const parsed = safeParseForm(saleSchema, formData);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  const gross = d.grossAmount;
  const discount = d.discountAmount ?? 0;
  const fees = d.feeAmount ?? 0;
  const net = +(gross - discount - fees).toFixed(2);
  if (net <= 0) return fail("Valor líquido precisa ser positivo (bruto − descontos − taxas).");

  const n = d.installmentsCount;
  const parcelaBase = +(net / n).toFixed(2);
  const ultimaParcela = +(net - parcelaBase * (n - 1)).toFixed(2);

  const product = await prisma.product.findUnique({
    where: { id: d.productId },
    select: { id: true, categoryId: true, costCenterId: true, defaultCommissionPercent: true },
  });
  if (!product) return fail("Produto não encontrado.");

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        customerId: d.customerId,
        productId: d.productId,
        sellerId: d.sellerId || null,
        categoryId: d.categoryId || product.categoryId || null,
        costCenterId: d.costCenterId || product.costCenterId || null,
        status: "ABERTA",
        origin: d.origin,
        saleDate: d.saleDate,
        grossAmount: gross,
        discountAmount: discount,
        feeAmount: fees,
        netAmount: net,
        installmentsCount: n,
        paymentMethodId: d.paymentMethodId || null,
        notes: d.notes,
      },
    });

    for (let i = 0; i < n; i++) {
      await tx.revenueInstallment.create({
        data: {
          saleId: created.id,
          number: i + 1,
          amount: i === n - 1 ? ultimaParcela : parcelaBase,
          dueDate: addMonths(d.firstDueDate, i),
          status: "PENDENTE",
          paymentMethodId: d.paymentMethodId || null,
          bankAccountId: d.bankAccountId || null,
        },
      });
    }

    // Comissão (se vendedor + % > 0)
    const percent = d.commissionPercent ?? Number(product.defaultCommissionPercent ?? 0);
    if (d.sellerId && percent > 0) {
      const commissionAmount = +(net * (percent / 100)).toFixed(2);
      await tx.commission.create({
        data: {
          payeeId: d.sellerId,
          saleId: created.id,
          base: "LIQUIDO",
          percent,
          amount: commissionAmount,
          status: "PENDENTE",
        },
      });
    }

    // Atualiza primeira/última compra do cliente
    const cust = await tx.customer.findUnique({ where: { id: d.customerId }, select: { firstPurchaseAt: true } });
    await tx.customer.update({
      where: { id: d.customerId },
      data: {
        lastPurchaseAt: d.saleDate,
        firstPurchaseAt: cust?.firstPurchaseAt ?? d.saleDate,
      },
    });

    await audit(session.user.id, "CRIAR", "Sale", created.id, undefined, {
      customerId: d.customerId, productId: d.productId, netAmount: net, installments: n,
    }, tx);
    return created;
  });

  revalidatePath("/receitas");
  revalidatePath("/contas-a-receber");
  revalidatePath("/parcelamentos");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return ok({ id: sale.id });
}

export async function cancelSale(saleId: string): Promise<ActionResult> {
  const session = await requireWrite();
  await prisma.$transaction(async (tx) => {
    await audit(session.user.id, "CANCELAR", "Sale", saleId, undefined, undefined, tx);
    await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELADA" } });
    await tx.revenueInstallment.updateMany({
      where: { saleId, status: { in: ["PENDENTE", "VENCIDO", "PARCIALMENTE_PAGO", "EM_NEGOCIACAO"] } },
      data: { status: "CANCELADO" },
    });
    await tx.commission.updateMany({
      where: { saleId, status: { in: ["PENDENTE", "LIBERADA"] } },
      data: { status: "CANCELADA" },
    });
    const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { customerId: true } });
    if (sale) await recomputeCustomerStatus(sale.customerId, tx);
  });
  revalidatePath("/receitas");
  revalidatePath("/contas-a-receber");
  revalidatePath("/parcelamentos");
  revalidatePath("/clientes");
  return ok();
}

export async function registerChargeback(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireWrite();
  const parsed = safeParseForm(chargebackSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { saleId, amount, disputedAt, reason } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { customerId: true } });
    if (!sale) return;
    await tx.chargeback.create({
      data: { saleId, customerId: sale.customerId, amount, reason, disputedAt },
    });
    await tx.sale.update({ where: { id: saleId }, data: { status: "CHARGEBACK" } });
    await tx.commission.updateMany({
      where: { saleId, status: { in: ["PENDENTE", "LIBERADA"] } },
      data: { status: "BLOQUEADA" },
    });
    await audit(session.user.id, "CHARGEBACK", "Sale", saleId, undefined, { amount }, tx);
  });
  revalidatePath("/receitas");
  revalidatePath("/comissoes");
  revalidatePath("/dashboard");
  return ok();
}

export async function registerRefund(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireWrite();
  const parsed = safeParseForm(refundSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { saleId, amount, processedAt, reason } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { customerId: true } });
    if (!sale) return;
    await tx.refund.create({
      data: { saleId, customerId: sale.customerId, amount, reason, processedAt },
    });
    await tx.sale.update({ where: { id: saleId }, data: { status: "REEMBOLSADA" } });
    await tx.commission.updateMany({
      where: { saleId, status: { in: ["PENDENTE", "LIBERADA"] } },
      data: { status: "ESTORNADA" },
    });
    await audit(session.user.id, "REEMBOLSAR", "Sale", saleId, undefined, { amount }, tx);
  });

  revalidatePath("/receitas");
  revalidatePath("/comissoes");
  revalidatePath("/dashboard");
  return ok();
}
