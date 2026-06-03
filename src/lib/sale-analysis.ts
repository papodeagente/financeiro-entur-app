import { prisma } from "./db";

export type SaleAnalysisInput = {
  customerId?: string;
  customerEmail?: string;
  customerDocument?: string;
  productId: string;
  netAmount: number;
  saleDate: Date;
  receiptUrl?: string;
  contractUrl?: string;
};

export type SaleWarning = {
  kind: "duplicate" | "value_deviation" | "active_product" | "delinquent" | "missing_receipt" | "missing_contract";
  severity: "info" | "warn" | "danger";
  message: string;
  details?: Record<string, string | number | boolean>;
};

const DUP_WINDOW_DAYS = 7;
const VALUE_DEVIATION_THRESHOLD_PCT = 15; // alerta se diferença > 15% do preço padrão

export async function analyzeSale(input: SaleAnalysisInput): Promise<SaleWarning[]> {
  const warnings: SaleWarning[] = [];
  const dayMs = 86400000;
  const from = new Date(input.saleDate.getTime() - DUP_WINDOW_DAYS * dayMs);
  const to = new Date(input.saleDate.getTime() + DUP_WINDOW_DAYS * dayMs);

  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { name: true, defaultPrice: true } });

  // 1. Duplicata: cliente + produto + valor próximo nos últimos 7 dias
  if (input.customerId) {
    const valueLow = input.netAmount * 0.95;
    const valueHigh = input.netAmount * 1.05;
    const similar = await prisma.sale.findFirst({
      where: {
        deletedAt: null,
        customerId: input.customerId,
        productId: input.productId,
        saleDate: { gte: from, lte: to },
        netAmount: { gte: valueLow, lte: valueHigh },
      },
      select: { id: true, saleDate: true, netAmount: true },
    });
    if (similar) {
      warnings.push({
        kind: "duplicate",
        severity: "danger",
        message: `Possível venda duplicada — existe outra venda do mesmo cliente e produto em ${similar.saleDate.toLocaleDateString("pt-BR")} com valor parecido.`,
        details: { existingSaleId: similar.id },
      });
    }
  } else if (input.customerEmail || input.customerDocument) {
    const matching = await prisma.customer.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(input.customerEmail ? [{ email: input.customerEmail }] : []),
          ...(input.customerDocument ? [{ document: input.customerDocument }] : []),
        ],
      },
      select: { id: true },
    });
    if (matching) {
      const similar = await prisma.sale.findFirst({
        where: {
          deletedAt: null,
          customerId: matching.id,
          productId: input.productId,
          saleDate: { gte: from, lte: to },
        },
        select: { id: true, saleDate: true, netAmount: true },
      });
      if (similar) {
        warnings.push({
          kind: "duplicate",
          severity: "danger",
          message: `Cliente com email/CPF informado já tem venda deste produto em ${similar.saleDate.toLocaleDateString("pt-BR")}.`,
        });
      }
    }
  }

  // 2. Valor fora do padrão
  if (product) {
    const expected = Number(product.defaultPrice);
    if (expected > 0) {
      const diff = ((input.netAmount - expected) / expected) * 100;
      if (Math.abs(diff) > VALUE_DEVIATION_THRESHOLD_PCT) {
        warnings.push({
          kind: "value_deviation",
          severity: diff < 0 ? "warn" : "info",
          message: `Valor ${diff > 0 ? `${diff.toFixed(0)}% acima` : `${Math.abs(diff).toFixed(0)}% abaixo`} do padrão (R$ ${expected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
          details: { expected, actual: input.netAmount, deviationPct: diff },
        });
      }
    }
  }

  // 3. Cliente já tem compra ativa do mesmo produto
  if (input.customerId) {
    const active = await prisma.sale.findFirst({
      where: {
        deletedAt: null,
        customerId: input.customerId,
        productId: input.productId,
        status: { in: ["ABERTA", "CONCLUIDA"] },
        validationStatus: "VALIDATED",
        installments: { some: { status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "PAGO"] } } },
      },
      select: { id: true, saleDate: true },
    });
    if (active) {
      warnings.push({
        kind: "active_product",
        severity: "warn",
        message: `Cliente já tem compra ativa deste produto desde ${active.saleDate.toLocaleDateString("pt-BR")}.`,
      });
    }
  }

  // 4. Cliente inadimplente
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { status: true } });
    if (customer?.status === "INADIMPLENTE") {
      warnings.push({
        kind: "delinquent",
        severity: "danger",
        message: "Cliente está com status INADIMPLENTE no sistema. Verifique antes de validar.",
      });
    }
  }

  // 5. Faltam anexos
  if (!input.receiptUrl) {
    warnings.push({ kind: "missing_receipt", severity: "info", message: "Sem comprovante de pagamento anexado." });
  }
  if (!input.contractUrl) {
    warnings.push({ kind: "missing_contract", severity: "info", message: "Sem contrato anexado." });
  }

  return warnings;
}
