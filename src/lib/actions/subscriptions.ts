"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { subscriptionSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { addMonths } from "@/lib/dates";
import { revalidatePath } from "next/cache";

const monthsByPeriod: Record<string, number> = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

export async function upsertSubscription(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(subscriptionSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, customerId, productId, amount, period, startDate, nextChargeAt, paymentMethodId, expiresAt } = parsed.data;

  const computedNext = nextChargeAt ?? addMonths(startDate, monthsByPeriod[period]);

  try {
    if (id) {
      await prisma.subscription.update({
        where: { id },
        data: { customerId, productId, amount, period, startDate, nextChargeAt: computedNext, paymentMethodId: paymentMethodId || null, expiresAt: expiresAt ?? null },
      });
    } else {
      await prisma.subscription.create({
        data: { customerId, productId, amount, period, startDate, nextChargeAt: computedNext, paymentMethodId: paymentMethodId || null, expiresAt: expiresAt ?? null, status: "ATIVA" },
      });
    }
  } catch {
    return fail("Erro ao salvar assinatura.");
  }
  revalidatePath("/assinaturas");
  revalidatePath("/dashboard");
  return ok();
}

export async function pauseSubscription(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.subscription.update({ where: { id }, data: { status: "PAUSADA", pausedAt: new Date() } });
  revalidatePath("/assinaturas");
  return ok();
}

export async function cancelSubscription(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.subscription.update({ where: { id }, data: { status: "CANCELADA", cancelledAt: new Date() } });
  revalidatePath("/assinaturas");
  revalidatePath("/dashboard");
  return ok();
}

export async function reactivateSubscription(id: string): Promise<ActionResult> {
  await requireWrite();
  const s = await prisma.subscription.findUnique({ where: { id } });
  if (!s) return fail("Assinatura não encontrada.");
  const months = monthsByPeriod[s.period] ?? 1;
  const today = new Date();
  await prisma.subscription.update({
    where: { id },
    data: { status: "ATIVA", pausedAt: null, cancelledAt: null, nextChargeAt: s.nextChargeAt ?? addMonths(today, months) },
  });
  revalidatePath("/assinaturas");
  revalidatePath("/dashboard");
  return ok();
}

export async function registerSubscriptionCharge(id: string, bankAccountId?: string): Promise<ActionResult> {
  await requireWrite();
  const s = await prisma.subscription.findUnique({ where: { id } });
  if (!s) return fail("Assinatura não encontrada.");
  const months = monthsByPeriod[s.period] ?? 1;
  const newNext = addMonths(s.nextChargeAt ?? new Date(), months);
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: { chargesCount: { increment: 1 }, nextChargeAt: newNext, status: "ATIVA" },
    });
    if (bankAccountId) {
      await tx.bankTransaction.create({
        data: { bankAccountId, direction: "CREDITO", amount: s.amount, occurredAt: new Date(),
          description: `Cobrança assinatura ${s.id.slice(0, 8)}`, refType: "SUBSCRIPTION", refId: s.id },
      });
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: { currentBalance: { increment: s.amount } } });
    }
  });
  revalidatePath("/assinaturas");
  revalidatePath("/dashboard");
  return ok();
}
