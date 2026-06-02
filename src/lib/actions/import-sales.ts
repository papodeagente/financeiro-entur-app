"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { parseSalesCsv, inferOrigin, type Platform, type SaleImportRow } from "@/lib/imports/sales-parsers";
import { addMonths } from "@/lib/dates";
import type { SaleOrigin, SaleStatus, InstallmentStatus } from "@prisma/client";

export type ParsePreview = {
  preview: SaleImportRow[];
  totalRows: number;
  parseErrors: { row: number; message: string }[];
  unmatchedProducts: string[];
};

export async function parseSalesFile(_: ActionResult<ParsePreview> | null, formData: FormData): Promise<ActionResult<ParsePreview>> {
  await requireWrite();
  const file = formData.get("file");
  const platformRaw = formData.get("platform");
  if (!(file instanceof File)) return fail("Selecione um arquivo CSV.");
  if (file.size > 10 * 1024 * 1024) return fail("Arquivo grande demais (limite 10MB).");
  const platform = (platformRaw === "hotmart" || platformRaw === "eduzz" || platformRaw === "kiwify" ? platformRaw : "generic") as Platform;

  const text = await file.text();
  const result = parseSalesCsv(text, platform);

  if (result.rows.length === 0 && result.errors.length === 0) {
    return fail("Não encontrei vendas válidas no arquivo. Verifique colunas (cliente, produto, valor, data).");
  }

  const productNames = Array.from(new Set(result.rows.map((r) => r.productName.toLowerCase().trim())));
  const products = productNames.length ? await prisma.product.findMany({
    where: { deletedAt: null, name: { in: productNames, mode: "insensitive" } },
    select: { id: true, name: true },
  }) : [];
  const found = new Set(products.map((p) => p.name.toLowerCase().trim()));
  const unmatched = productNames.filter((n) => !found.has(n));

  return ok({
    preview: result.rows.slice(0, 100),
    totalRows: result.rows.length,
    parseErrors: result.errors,
    unmatchedProducts: unmatched,
  });
}

export type ImportOptions = {
  platform: Platform;
  defaultSellerId?: string;
  createMissingProducts: boolean;
  createMissingCustomers: boolean;
  skipPaid: boolean; // Se importou todas como PAGAS, marca as parcelas com status PAGO
};

export async function importSales(rows: SaleImportRow[], options: ImportOptions): Promise<ActionResult<{ created: number; skipped: number }>> {
  await requireWrite();
  let created = 0, skipped = 0;
  for (const r of rows) {
    try {
      // Cliente (cria se não existe)
      let customer = await prisma.customer.findFirst({
        where: { OR: [
          ...(r.customerEmail ? [{ email: r.customerEmail }] : []),
          ...(r.customerDocument ? [{ document: r.customerDocument }] : []),
          { name: r.customerName },
        ], deletedAt: null },
      });
      if (!customer) {
        if (!options.createMissingCustomers) { skipped++; continue; }
        customer = await prisma.customer.create({
          data: { name: r.customerName, email: r.customerEmail, document: r.customerDocument, status: "ATIVO" },
        });
      }

      // Produto (procura ou cria)
      let product = await prisma.product.findFirst({
        where: { deletedAt: null, name: { equals: r.productName, mode: "insensitive" } },
      });
      if (!product) {
        if (!options.createMissingProducts) { skipped++; continue; }
        product = await prisma.product.create({
          data: { name: r.productName, type: "CURSO", billing: "UNICA", defaultPrice: r.grossAmount, active: true },
        });
      }

      // Status mapping
      const saleStatus: SaleStatus =
        r.status === "REFUNDED" ? "REEMBOLSADA" :
        r.status === "CHARGEBACK" ? "CHARGEBACK" :
        r.status === "PAID" ? "CONCLUIDA" : "ABERTA";

      const installmentStatus: InstallmentStatus =
        options.skipPaid || r.status === "PAID" ? "PAGO" :
        r.status === "REFUNDED" ? "REEMBOLSADO" :
        r.status === "CHARGEBACK" ? "CHARGEBACK" : "PENDENTE";

      const origin = inferOrigin(r.origin) as SaleOrigin;
      const saleDate = new Date(r.saleDate);
      const parcelaBase = +(r.netAmount / r.installmentsCount).toFixed(2);
      const ultimaParcela = +(r.netAmount - parcelaBase * (r.installmentsCount - 1)).toFixed(2);

      await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            customerId: customer!.id, productId: product!.id,
            sellerId: options.defaultSellerId || null,
            status: saleStatus, origin, saleDate,
            grossAmount: r.grossAmount, discountAmount: 0,
            feeAmount: r.feeAmount, netAmount: r.netAmount,
            installmentsCount: r.installmentsCount,
            externalId: r.externalId, integrationSource: options.platform,
          },
        });
        for (let i = 0; i < r.installmentsCount; i++) {
          await tx.revenueInstallment.create({
            data: {
              saleId: sale.id, number: i + 1,
              amount: i === r.installmentsCount - 1 ? ultimaParcela : parcelaBase,
              dueDate: addMonths(saleDate, i),
              paidAmount: installmentStatus === "PAGO" ? (i === r.installmentsCount - 1 ? ultimaParcela : parcelaBase) : 0,
              paidAt: installmentStatus === "PAGO" ? saleDate : null,
              status: installmentStatus,
            },
          });
        }
        await tx.customer.update({
          where: { id: customer!.id },
          data: {
            lastPurchaseAt: saleDate,
            firstPurchaseAt: customer!.firstPurchaseAt ?? saleDate,
          },
        });
      });
      created++;
    } catch { skipped++; }
  }

  revalidatePath("/receitas");
  revalidatePath("/contas-a-receber");
  revalidatePath("/dashboard");
  revalidatePath("/clientes");
  return ok({ created, skipped });
}
