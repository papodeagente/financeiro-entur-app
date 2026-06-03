"use server";
import { prisma } from "@/lib/db";
import { requireRole, requireSession, requireWrite } from "@/lib/session";
import { saleSchema, refundSchema, chargebackSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { addMonths } from "@/lib/dates";
import { recomputeCustomerStatus } from "@/lib/finance-ops";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";

const isSellerRole = (r: UserRole) => r === "COMERCIAL" || r === "CONSULTOR";

async function generateRevenueArtifacts(
  tx: Prisma.TransactionClient, saleId: string, opts: {
    netAmount: number; installmentsCount: number; firstDueDate: Date;
    paymentMethodId?: string | null; bankAccountId?: string | null;
    sellerId?: string | null; commissionPercent: number;
  },
) {
  const n = opts.installmentsCount;
  const parcelaBase = +(opts.netAmount / n).toFixed(2);
  const ultimaParcela = +(opts.netAmount - parcelaBase * (n - 1)).toFixed(2);

  for (let i = 0; i < n; i++) {
    await tx.revenueInstallment.create({
      data: {
        saleId, number: i + 1,
        amount: i === n - 1 ? ultimaParcela : parcelaBase,
        dueDate: addMonths(opts.firstDueDate, i),
        status: "PENDENTE",
        paymentMethodId: opts.paymentMethodId || null,
        bankAccountId: opts.bankAccountId || null,
      },
    });
  }

  if (opts.sellerId && opts.commissionPercent > 0) {
    const commissionAmount = +(opts.netAmount * (opts.commissionPercent / 100)).toFixed(2);
    await tx.commission.create({
      data: {
        payeeId: opts.sellerId, saleId,
        base: "LIQUIDO", percent: opts.commissionPercent,
        amount: commissionAmount, status: "PENDENTE",
      },
    });
  }
}

async function notifyFinancials(title: string, body: string, link: string) {
  const financials = await prisma.user.findMany({
    where: { deletedAt: null, active: true, role: { in: ["ADMIN", "FINANCEIRO"] } },
    select: { id: true },
  });
  for (const u of financials) {
    await notify({ userId: u.id, kind: "ALERTA", title, body, link });
  }
}

// ─── CREATE SALE ───────────────────────────
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

  const product = await prisma.product.findUnique({
    where: { id: d.productId },
    select: { id: true, categoryId: true, costCenterId: true, defaultCommissionPercent: true },
  });
  if (!product) return fail("Produto não encontrado.");

  const sellerCreated = isSellerRole(session.user.role);
  const validationStatus = sellerCreated ? "PENDING_VALIDATION" : "VALIDATED";
  const commissionPercent = d.commissionPercent ?? Number(product.defaultCommissionPercent ?? 0);

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        customerId: d.customerId,
        productId: d.productId,
        sellerId: d.sellerId || (sellerCreated ? session.user.id : null),
        sdrId: d.sdrId || null,
        submittedById: session.user.id,
        validatedById: sellerCreated ? null : session.user.id,
        validatedAt: sellerCreated ? null : new Date(),
        validationStatus,
        categoryId: d.categoryId || product.categoryId || null,
        costCenterId: d.costCenterId || product.costCenterId || null,
        status: "ABERTA",
        origin: d.origin,
        saleDate: d.saleDate,
        firstDueDate: d.firstDueDate,
        grossAmount: gross, discountAmount: discount, feeAmount: fees, netAmount: net,
        entryAmount: d.entryAmount,
        installmentsCount: d.installmentsCount,
        paymentMethodId: d.paymentMethodId || null,
        cohort: d.cohort, campaign: d.campaign,
        crmLink: d.crmLink, receiptUrl: d.receiptUrl, contractUrl: d.contractUrl,
        notes: d.notes,
      },
    });

    if (validationStatus === "VALIDATED") {
      await generateRevenueArtifacts(tx, created.id, {
        netAmount: net, installmentsCount: d.installmentsCount, firstDueDate: d.firstDueDate,
        paymentMethodId: d.paymentMethodId, bankAccountId: d.bankAccountId,
        sellerId: d.sellerId || null, commissionPercent,
      });
    }

    const cust = await tx.customer.findUnique({ where: { id: d.customerId }, select: { firstPurchaseAt: true } });
    await tx.customer.update({
      where: { id: d.customerId },
      data: { lastPurchaseAt: d.saleDate, firstPurchaseAt: cust?.firstPurchaseAt ?? d.saleDate },
    });

    await audit(session.user.id, "CRIAR", "Sale", created.id, undefined, {
      validationStatus, netAmount: net, installments: d.installmentsCount,
    }, tx);
    return created;
  });

  if (sellerCreated) {
    await notifyFinancials(
      "Nova venda aguardando validação",
      `${session.user.name} lançou uma venda de ${net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — revise e valide.`,
      `/receitas/${sale.id}`,
    );
  }

  revalidatePath("/receitas");
  revalidatePath("/contas-a-receber");
  revalidatePath("/parcelamentos");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  revalidatePath("/minhas-vendas");
  return ok({ id: sale.id });
}

// ─── EDIT SALE ────────────────────────────
const editSaleSchema = z.object({
  saleId: z.string().min(1),
  productId: z.string().min(1),
  grossAmount: z.string().transform((s) => Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0),
  feeAmount: z.string().optional().transform((s) => (!s ? 0 : Number(s.replace(/\./g, "").replace(",", ".")) || 0)),
  installmentsCount: z.string().transform((s) => Math.max(1, parseInt(s, 10) || 1)),
  paymentMethodId: z.string().optional(),
  cohort: z.string().optional(),
  campaign: z.string().optional(),
  crmLink: z.string().optional(),
  receiptUrl: z.string().optional(),
  contractUrl: z.string().optional(),
  notes: z.string().optional(),
});

export async function editPendingSale(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = safeParseForm(editSaleSchema, formData);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  const sale = await prisma.sale.findUnique({ where: { id: d.saleId }, select: { id: true, submittedById: true, sellerId: true, validationStatus: true } });
  if (!sale) return fail("Venda não encontrada.");

  const isOwner = sale.submittedById === session.user.id || sale.sellerId === session.user.id;
  const isFinancial = session.user.role === "ADMIN" || session.user.role === "FINANCEIRO";
  if (!isOwner && !isFinancial) return fail("Sem permissão para editar esta venda.");
  if (!isFinancial && sale.validationStatus !== "PENDING_VALIDATION" && sale.validationStatus !== "NEEDS_ADJUSTMENT") {
    return fail("Venda já foi validada. Solicite correção ao financeiro.");
  }

  const net = +(d.grossAmount - d.feeAmount).toFixed(2);
  await prisma.sale.update({
    where: { id: d.saleId },
    data: {
      productId: d.productId,
      grossAmount: d.grossAmount, feeAmount: d.feeAmount, netAmount: net,
      installmentsCount: d.installmentsCount,
      paymentMethodId: d.paymentMethodId || null,
      cohort: d.cohort || null, campaign: d.campaign || null,
      crmLink: d.crmLink || null, receiptUrl: d.receiptUrl || null, contractUrl: d.contractUrl || null,
      notes: d.notes || null,
      validationStatus: sale.validationStatus === "NEEDS_ADJUSTMENT" ? "PENDING_VALIDATION" : sale.validationStatus,
    },
  });
  await audit(session.user.id, "EDITAR", "Sale", d.saleId);

  if (sale.validationStatus === "NEEDS_ADJUSTMENT") {
    await notifyFinancials(
      "Venda corrigida e reenviada pra validação",
      `${session.user.name} corrigiu uma venda que estava em ajuste.`,
      `/receitas/${d.saleId}`,
    );
  }

  revalidatePath("/receitas");
  revalidatePath(`/receitas/${d.saleId}`);
  revalidatePath("/minhas-vendas");
  return ok();
}

// ─── VALIDATE SALE ──────────────────────────
export async function validateSale(saleId: string): Promise<ActionResult> {
  const session = await requireRole(["ADMIN", "FINANCEIRO"]);
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: { select: { defaultCommissionPercent: true } } },
  });
  if (!sale) return fail("Venda não encontrada.");
  if (sale.validationStatus === "VALIDATED") return fail("Venda já validada.");

  const commissionPercent = Number(sale.product.defaultCommissionPercent ?? 0);
  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: { validationStatus: "VALIDATED", validatedAt: new Date(), validatedById: session.user.id, status: "ABERTA", rejectedReason: null, adjustmentReason: null },
    });
    const existingInstallments = await tx.revenueInstallment.count({ where: { saleId } });
    if (existingInstallments === 0) {
      await generateRevenueArtifacts(tx, saleId, {
        netAmount: Number(sale.netAmount),
        installmentsCount: sale.installmentsCount,
        firstDueDate: sale.firstDueDate ?? sale.saleDate,
        paymentMethodId: sale.paymentMethodId, bankAccountId: null,
        sellerId: sale.sellerId, commissionPercent,
      });
    }
    await audit(session.user.id, "EDITAR", "Sale", saleId, undefined, { action: "validated" }, tx);
  });

  if (sale.submittedById) {
    await notify({
      userId: sale.submittedById, kind: "SUCESSO",
      title: "Venda validada pelo financeiro",
      body: `Sua venda foi validada. Parcelas e comissão geradas.`,
      link: `/receitas/${saleId}`,
    });
  }

  revalidatePath("/receitas");
  revalidatePath(`/receitas/${saleId}`);
  revalidatePath("/contas-a-receber");
  revalidatePath("/comissoes");
  revalidatePath("/minhas-vendas");
  revalidatePath("/dashboard");
  return ok();
}

// ─── REJECT SALE ────────────────────────────
export async function rejectSale(saleId: string, reason: string): Promise<ActionResult> {
  const session = await requireRole(["ADMIN", "FINANCEIRO"]);
  if (!reason || reason.trim().length < 3) return fail("Informe um motivo para a reprovação.");

  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { submittedById: true } });
  if (!sale) return fail("Venda não encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: { validationStatus: "REJECTED", rejectedReason: reason, status: "CANCELADA", validatedById: session.user.id, validatedAt: new Date() },
    });
    await audit(session.user.id, "CANCELAR", "Sale", saleId, undefined, { reason }, tx);
  });

  if (sale.submittedById) {
    await notify({
      userId: sale.submittedById, kind: "ERRO",
      title: "Venda reprovada pelo financeiro",
      body: `Motivo: ${reason}`,
      link: `/receitas/${saleId}`,
    });
  }
  revalidatePath("/receitas");
  revalidatePath(`/receitas/${saleId}`);
  revalidatePath("/minhas-vendas");
  return ok();
}

// ─── REQUEST ADJUSTMENT ─────────────────────
export async function requestAdjustment(saleId: string, reason: string): Promise<ActionResult> {
  const session = await requireRole(["ADMIN", "FINANCEIRO"]);
  if (!reason || reason.trim().length < 3) return fail("Informe o que precisa ajustar.");
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { submittedById: true } });
  if (!sale) return fail("Venda não encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: { validationStatus: "NEEDS_ADJUSTMENT", adjustmentReason: reason },
    });
    await audit(session.user.id, "EDITAR", "Sale", saleId, undefined, { adjustmentRequested: reason }, tx);
  });

  if (sale.submittedById) {
    await notify({
      userId: sale.submittedById, kind: "ALERTA",
      title: "Financeiro solicitou ajuste na sua venda",
      body: `Motivo: ${reason}`,
      link: `/minhas-vendas`,
    });
  }
  revalidatePath("/receitas");
  revalidatePath(`/receitas/${saleId}`);
  revalidatePath("/minhas-vendas");
  return ok();
}

// ─── MARK DUPLICATE ─────────────────────────
export async function markDuplicate(saleId: string): Promise<ActionResult> {
  const session = await requireRole(["ADMIN", "FINANCEIRO"]);
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { submittedById: true } });
  if (!sale) return fail("Venda não encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: { validationStatus: "DUPLICATED", status: "CANCELADA", validatedById: session.user.id, validatedAt: new Date() },
    });
    await audit(session.user.id, "CANCELAR", "Sale", saleId, undefined, { reason: "duplicated" }, tx);
  });
  if (sale.submittedById) {
    await notify({
      userId: sale.submittedById, kind: "ALERTA",
      title: "Venda marcada como duplicada",
      body: "Financeiro identificou esta venda como duplicata de outra. Confira em /minhas-vendas.",
      link: "/minhas-vendas",
    });
  }
  revalidatePath("/receitas");
  revalidatePath(`/receitas/${saleId}`);
  revalidatePath("/minhas-vendas");
  return ok();
}

// ─── EXISTING ────────────────────────────
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
