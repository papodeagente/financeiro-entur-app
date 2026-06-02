"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { bankAccountSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export async function upsertBankAccount(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(bankAccountSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, name, type, bank, agency, accountNumber, openingBalance, notes } = parsed.data;
  try {
    if (id) {
      // Saldo atual só muda em alterações de openingBalance se for nova conta — pra preservar histórico,
      // edição não recalcula currentBalance, apenas atualiza openingBalance como referência.
      await prisma.bankAccount.update({
        where: { id },
        data: { name, type, bank, agency, accountNumber, openingBalance, notes },
      });
    } else {
      await prisma.bankAccount.create({
        data: { name, type, bank, agency, accountNumber, openingBalance, currentBalance: openingBalance, notes },
      });
    }
  } catch {
    return fail("Erro ao salvar conta bancária.");
  }
  revalidatePath("/contas-bancarias");
  return ok();
}

export async function toggleBankAccountActive(id: string): Promise<ActionResult> {
  await requireWrite();
  const acc = await prisma.bankAccount.findUnique({ where: { id }, select: { active: true } });
  if (!acc) return fail("Conta não encontrada.");
  await prisma.bankAccount.update({ where: { id }, data: { active: !acc.active } });
  revalidatePath("/contas-bancarias");
  return ok();
}
