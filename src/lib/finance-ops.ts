import { prisma } from "./db";
import { startOfDay } from "./dates";
import type { Prisma } from "@prisma/client";

/**
 * Marca como VENCIDO todas as parcelas pendentes cujo dueDate < hoje.
 * Idempotente — pode ser chamado várias vezes.
 */
export async function syncOverdueInstallments(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const today = startOfDay(new Date());
  await tx.revenueInstallment.updateMany({
    where: {
      deletedAt: null,
      dueDate: { lt: today },
      status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] },
    },
    data: { status: "VENCIDO" },
  });
}

/**
 * Marca despesas pendentes/agendadas com dueDate < hoje como VENCIDO.
 */
export async function syncOverdueExpenses(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const today = startOfDay(new Date());
  await tx.expense.updateMany({
    where: {
      deletedAt: null,
      dueDate: { lt: today },
      paidAt: null,
      status: { in: ["PENDENTE", "AGENDADO"] },
    },
    data: { status: "VENCIDO" },
  });
}

/**
 * Recalcula o status financeiro do cliente:
 *   - se tem qualquer parcela vencida → INADIMPLENTE
 *   - senão, se estava INADIMPLENTE → volta para ATIVO
 *   - outros status (CANCELADO, REEMBOLSADO, EX_ALUNO) não são tocados
 */
export async function recomputeCustomerStatus(
  customerId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const overdueCount = await tx.revenueInstallment.count({
    where: {
      deletedAt: null,
      status: "VENCIDO",
      sale: { customerId, deletedAt: null },
    },
  });
  const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { status: true } });
  if (!customer) return;
  if (overdueCount > 0 && customer.status === "ATIVO") {
    await tx.customer.update({ where: { id: customerId }, data: { status: "INADIMPLENTE" } });
  } else if (overdueCount === 0 && customer.status === "INADIMPLENTE") {
    await tx.customer.update({ where: { id: customerId }, data: { status: "ATIVO" } });
  }
}

/**
 * Cria uma transação bancária e ajusta o saldo da conta.
 */
export async function postBankCredit(
  bankAccountId: string, amount: number, description: string, refType: string, refId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await tx.bankTransaction.create({
    data: { bankAccountId, direction: "CREDITO", amount, occurredAt: new Date(), description, refType, refId },
  });
  await tx.bankAccount.update({
    where: { id: bankAccountId },
    data: { currentBalance: { increment: amount } },
  });
}

export async function postBankDebit(
  bankAccountId: string, amount: number, description: string, refType: string, refId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await tx.bankTransaction.create({
    data: { bankAccountId, direction: "DEBITO", amount, occurredAt: new Date(), description, refType, refId },
  });
  await tx.bankAccount.update({
    where: { id: bankAccountId },
    data: { currentBalance: { decrement: amount } },
  });
}
