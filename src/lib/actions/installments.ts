"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { markPaidSchema, changeDueDateSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { recomputeCustomerStatus, postBankCredit } from "@/lib/finance-ops";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function markInstallmentPaid(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireWrite();
  const parsed = safeParseForm(markPaidSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { installmentId, paidAt, paidAmount, bankAccountId, paymentMethodId } = parsed.data;

  const inst = await prisma.revenueInstallment.findUnique({
    where: { id: installmentId },
    include: { sale: { select: { customerId: true, productId: true, id: true } } },
  });
  if (!inst) return fail("Parcela não encontrada.");

  const total = Number(inst.amount);
  const previous = Number(inst.paidAmount);
  const cumulative = +(previous + paidAmount).toFixed(2);
  if (cumulative > total) return fail(`Pagamento excede o valor da parcela (${total.toFixed(2)}).`);

  const newStatus = cumulative >= total ? "PAGO" : "PARCIALMENTE_PAGO";

  await prisma.$transaction(async (tx) => {
    await tx.revenueInstallment.update({
      where: { id: installmentId },
      data: {
        paidAmount: cumulative,
        paidAt: newStatus === "PAGO" ? paidAt : inst.paidAt ?? paidAt,
        status: newStatus,
        bankAccountId: bankAccountId || inst.bankAccountId,
        paymentMethodId: paymentMethodId || inst.paymentMethodId,
      },
    });

    if (bankAccountId) {
      await postBankCredit(
        bankAccountId, paidAmount,
        `Parcela ${inst.number} — venda ${inst.sale.id.slice(0, 8)}`,
        "INSTALLMENT", installmentId, tx,
      );
    }

    // Libera comissão proporcional ao pago (se estiver em PENDENTE e parcela ficou PAGA)
    if (newStatus === "PAGO") {
      await tx.commission.updateMany({
        where: { saleId: inst.sale.id, status: "PENDENTE" },
        data: { status: "LIBERADA" },
      });
    }

    // Se todas parcelas da venda estiverem pagas, marca Sale como CONCLUIDA
    const remaining = await tx.revenueInstallment.count({
      where: { saleId: inst.sale.id, status: { notIn: ["PAGO", "CANCELADO", "REEMBOLSADO", "CHARGEBACK"] } },
    });
    if (remaining === 0) {
      await tx.sale.update({ where: { id: inst.sale.id }, data: { status: "CONCLUIDA" } });
    }

    await recomputeCustomerStatus(inst.sale.customerId, tx);
    await audit(session.user.id, "MARCAR_PAGO", "RevenueInstallment", installmentId, undefined, { paidAmount, paidAt, bankAccountId }, tx);
  });

  revalidatePath("/contas-a-receber");
  revalidatePath("/receitas");
  revalidatePath("/parcelamentos");
  revalidatePath("/inadimplencia");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return ok();
}

export async function changeInstallmentDueDate(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireWrite();
  const parsed = safeParseForm(changeDueDateSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { installmentId, newDueDate, reason } = parsed.data;

  const inst = await prisma.revenueInstallment.findUnique({
    where: { id: installmentId }, include: { sale: { select: { customerId: true } } },
  });
  if (!inst) return fail("Parcela não encontrada.");

  const oldNotes = inst.notes ? inst.notes + "\n" : "";
  await prisma.revenueInstallment.update({
    where: { id: installmentId },
    data: {
      dueDate: newDueDate,
      status: inst.status === "VENCIDO" ? "PENDENTE" : inst.status,
      notes: reason ? `${oldNotes}[Vencimento alterado] ${reason}` : inst.notes,
    },
  });
  await recomputeCustomerStatus(inst.sale.customerId);
  await audit(session.user.id, "ALTERAR_VENCIMENTO", "RevenueInstallment", installmentId, { dueDate: inst.dueDate }, { dueDate: newDueDate, reason });

  revalidatePath("/contas-a-receber");
  revalidatePath("/inadimplencia");
  revalidatePath("/clientes");
  return ok();
}

export async function cancelInstallment(id: string): Promise<ActionResult> {
  await requireWrite();
  const inst = await prisma.revenueInstallment.findUnique({
    where: { id }, include: { sale: { select: { customerId: true } } },
  });
  if (!inst) return fail("Parcela não encontrada.");
  await prisma.revenueInstallment.update({ where: { id }, data: { status: "CANCELADO" } });
  await recomputeCustomerStatus(inst.sale.customerId);
  revalidatePath("/contas-a-receber");
  revalidatePath("/inadimplencia");
  return ok();
}

export async function setInstallmentNegotiating(id: string): Promise<ActionResult> {
  await requireWrite();
  const inst = await prisma.revenueInstallment.findUnique({
    where: { id }, include: { sale: { select: { customerId: true } } },
  });
  if (!inst) return fail("Parcela não encontrada.");
  await prisma.revenueInstallment.update({ where: { id }, data: { status: "EM_NEGOCIACAO" } });
  if (inst.sale) {
    await prisma.customer.update({
      where: { id: inst.sale.customerId },
      data: { status: "EM_NEGOCIACAO" },
    });
  }
  revalidatePath("/contas-a-receber");
  revalidatePath("/inadimplencia");
  revalidatePath("/clientes");
  return ok();
}
