"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { payCommissionSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { postBankDebit } from "@/lib/finance-ops";
import { revalidatePath } from "next/cache";

export async function payCommission(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(payCommissionSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { commissionId, paidAt, bankAccountId, notes } = parsed.data;

  const c = await prisma.commission.findUnique({
    where: { id: commissionId },
    include: { payee: { select: { name: true } } },
  });
  if (!c) return fail("Comissão não encontrada.");
  if (c.status !== "LIBERADA" && c.status !== "PENDENTE") return fail(`Comissão com status ${c.status} não pode ser paga.`);

  await prisma.$transaction(async (tx) => {
    await tx.commission.update({
      where: { id: commissionId },
      data: { status: "PAGA", paidAt, notes: notes ?? c.notes },
    });
    if (bankAccountId) {
      await postBankDebit(
        bankAccountId, Number(c.amount),
        `Comissão: ${c.payee.name} — venda ${c.saleId.slice(0, 8)}`,
        "COMMISSION", commissionId, tx,
      );
    }
  });

  revalidatePath("/comissoes");
  revalidatePath("/dashboard");
  return ok();
}

export async function blockCommission(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.commission.update({ where: { id }, data: { status: "BLOQUEADA" } });
  revalidatePath("/comissoes");
  return ok();
}

export async function releaseCommission(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.commission.update({ where: { id }, data: { status: "LIBERADA" } });
  revalidatePath("/comissoes");
  return ok();
}

export async function cancelCommission(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.commission.update({ where: { id }, data: { status: "CANCELADA" } });
  revalidatePath("/comissoes");
  return ok();
}
