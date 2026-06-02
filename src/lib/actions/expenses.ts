"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { expenseSchema, payExpenseSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { addMonths } from "@/lib/dates";
import { postBankDebit } from "@/lib/finance-ops";
import { revalidatePath } from "next/cache";

const monthsByRecurrence: Record<string, number> = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

export async function upsertExpense(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(expenseSchema, formData);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  try {
    if (d.id) {
      await prisma.expense.update({
        where: { id: d.id },
        data: {
          description: d.description,
          supplierId: d.supplierId || null,
          categoryId: d.categoryId || null,
          costCenterId: d.costCenterId || null,
          bankAccountId: d.bankAccountId || null,
          paymentMethodId: d.paymentMethodId || null,
          responsibleId: d.responsibleId || null,
          amount: d.amount,
          dueDate: d.dueDate,
          competenceDate: d.competenceDate,
          recurrence: d.recurrence,
          attachmentUrl: d.attachmentUrl,
          notes: d.notes,
        },
      });
    } else {
      const parentData = {
        description: d.description,
        supplierId: d.supplierId || null,
        categoryId: d.categoryId || null,
        costCenterId: d.costCenterId || null,
        bankAccountId: d.bankAccountId || null,
        paymentMethodId: d.paymentMethodId || null,
        responsibleId: d.responsibleId || null,
        amount: d.amount,
        recurrence: d.recurrence,
        attachmentUrl: d.attachmentUrl,
        notes: d.notes,
      };

      if (d.recurrence === "NENHUMA") {
        await prisma.expense.create({
          data: { ...parentData, dueDate: d.dueDate, competenceDate: d.competenceDate, status: "PENDENTE" },
        });
      } else {
        // Cria a recorrência: parent (1ª ocorrência) + N-1 children futuros
        const months = monthsByRecurrence[d.recurrence] ?? 1;
        await prisma.$transaction(async (tx) => {
          const parent = await tx.expense.create({
            data: { ...parentData, dueDate: d.dueDate, competenceDate: d.competenceDate, status: "PENDENTE" },
          });
          for (let i = 1; i < d.recurrenceMonths; i++) {
            await tx.expense.create({
              data: {
                ...parentData,
                dueDate: addMonths(d.dueDate, i * months),
                competenceDate: addMonths(d.competenceDate, i * months),
                recurrence: d.recurrence,
                recurrenceParentId: parent.id,
                status: "AGENDADO",
              },
            });
          }
        });
      }
    }
  } catch {
    return fail("Erro ao salvar despesa.");
  }

  revalidatePath("/despesas");
  revalidatePath("/contas-a-pagar");
  revalidatePath("/dashboard");
  return ok();
}

export async function markExpensePaid(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(payExpenseSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { expenseId, paidAt, bankAccountId, paymentMethodId, attachmentUrl } = parsed.data;

  const exp = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!exp) return fail("Despesa não encontrada.");
  if (exp.status === "PAGO") return fail("Despesa já está paga.");

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        paidAt, status: "PAGO",
        bankAccountId: bankAccountId || exp.bankAccountId,
        paymentMethodId: paymentMethodId || exp.paymentMethodId,
        attachmentUrl: attachmentUrl || exp.attachmentUrl,
      },
    });
    const ba = bankAccountId || exp.bankAccountId;
    if (ba) {
      await postBankDebit(ba, Number(exp.amount), `Despesa: ${exp.description}`, "EXPENSE", expenseId, tx);
    }
  });

  revalidatePath("/despesas");
  revalidatePath("/contas-a-pagar");
  revalidatePath("/dashboard");
  return ok();
}

export async function cancelExpense(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.expense.update({ where: { id }, data: { status: "CANCELADO" } });
  revalidatePath("/despesas");
  revalidatePath("/contas-a-pagar");
  return ok();
}

export async function duplicateExpense(id: string): Promise<ActionResult> {
  await requireWrite();
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) return fail("Despesa não encontrada.");
  await prisma.expense.create({
    data: {
      description: e.description,
      supplierId: e.supplierId, categoryId: e.categoryId,
      costCenterId: e.costCenterId, bankAccountId: e.bankAccountId,
      paymentMethodId: e.paymentMethodId, responsibleId: e.responsibleId,
      amount: e.amount, dueDate: addMonths(e.dueDate, 1),
      competenceDate: addMonths(e.competenceDate, 1),
      recurrence: "NENHUMA", notes: e.notes, status: "PENDENTE",
    },
  });
  revalidatePath("/despesas");
  revalidatePath("/contas-a-pagar");
  return ok();
}
