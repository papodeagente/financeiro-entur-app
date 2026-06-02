import { prisma } from "./db";
import type { Prisma, NotificationKind } from "@prisma/client";

export async function notify({
  userId, kind = "INFO", title, body, link,
}: {
  userId?: string | null;
  kind?: NotificationKind;
  title: string;
  body?: string;
  link?: string;
}, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  try {
    await tx.notification.create({
      data: { userId: userId ?? null, kind, title, body, link },
    });
  } catch { /* silent */ }
}

/**
 * Gera notificações de alerta de inadimplência e contas vencendo.
 * Idempotente por dia: usa fingerprint baseado em data+conteúdo pra não duplicar.
 */
export async function syncFinancialAlerts() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fp = today.toISOString().slice(0, 10);

  // Inadimplência hoje
  const overdueAgg = await prisma.revenueInstallment.aggregate({
    _sum: { amount: true, paidAmount: true },
    _count: true,
    where: { deletedAt: null, status: "VENCIDO" },
  });
  const overdueAmount = Number(overdueAgg._sum.amount ?? 0) - Number(overdueAgg._sum.paidAmount ?? 0);
  if (overdueAgg._count > 0 && overdueAmount > 0) {
    const fingerprint = `overdue-${fp}-${overdueAgg._count}-${overdueAmount.toFixed(2)}`;
    const exists = await prisma.notification.findFirst({ where: { title: { startsWith: "Inadimplência" }, body: { contains: fingerprint } } });
    if (!exists) {
      await notify({
        kind: "ALERTA",
        title: `Inadimplência: ${overdueAgg._count} parcela${overdueAgg._count > 1 ? "s" : ""} em atraso`,
        body: `${overdueAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a recuperar. [${fingerprint}]`,
        link: "/inadimplencia",
      });
    }
  }

  // Contas a pagar vencendo nos próximos 7 dias
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const apSoon = await prisma.expense.aggregate({
    _sum: { amount: true }, _count: true,
    where: { deletedAt: null, status: { in: ["PENDENTE", "AGENDADO"] }, dueDate: { gte: today, lt: in7 } },
  });
  if (apSoon._count > 0) {
    const amount = Number(apSoon._sum.amount ?? 0);
    const fingerprint = `ap7-${fp}-${apSoon._count}-${amount.toFixed(2)}`;
    const exists = await prisma.notification.findFirst({ where: { title: { startsWith: "Contas a pagar" }, body: { contains: fingerprint } } });
    if (!exists) {
      await notify({
        kind: "INFO",
        title: `Contas a pagar nos próximos 7 dias: ${apSoon._count}`,
        body: `${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a quitar. [${fingerprint}]`,
        link: "/contas-a-pagar?filter=proximos7",
      });
    }
  }

  // Caixa negativo previsto em 30 dias
  const balance = Number((await prisma.bankAccount.aggregate({ _sum: { currentBalance: true }, where: { active: true, deletedAt: null } }))._sum.currentBalance ?? 0);
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const [ar30, ap30] = await Promise.all([
    prisma.revenueInstallment.aggregate({
      _sum: { amount: true, paidAmount: true },
      where: { deletedAt: null, dueDate: { gte: today, lt: in30 }, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, dueDate: { gte: today, lt: in30 }, status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] } },
    }),
  ]);
  const projected = balance + (Number(ar30._sum.amount ?? 0) - Number(ar30._sum.paidAmount ?? 0)) - Number(ap30._sum.amount ?? 0);
  if (projected < 0) {
    const fingerprint = `cash30-${fp}-${projected.toFixed(2)}`;
    const exists = await prisma.notification.findFirst({ where: { title: { startsWith: "Caixa" }, body: { contains: fingerprint } } });
    if (!exists) {
      await notify({
        kind: "ERRO",
        title: "Caixa negativo previsto em 30 dias",
        body: `Projeção: ${projected.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. [${fingerprint}]`,
        link: "/fluxo-de-caixa",
      });
    }
  }
}
