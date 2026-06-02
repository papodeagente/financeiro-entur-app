import { z } from "zod";

const parseBrlNumber = (s: string): number => {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  return Number(cleaned);
};

const numberFromStr = z.string().min(1, "Valor obrigatório").transform((s, ctx) => {
  const n = parseBrlNumber(s);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor inválido" });
    return z.NEVER;
  }
  if (n < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor não pode ser negativo" });
    return z.NEVER;
  }
  return n;
});

const optNumberFromStr = z.string().optional().transform((s, ctx) => {
  if (!s || s.trim() === "") return undefined;
  const n = parseBrlNumber(s);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor inválido" });
    return z.NEVER;
  }
  return n;
});

const optInt = z.string().optional().transform((s, ctx) => {
  if (!s || s.trim() === "") return undefined;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor inteiro positivo" });
    return z.NEVER;
  }
  return n;
});

const optString = z.string().optional().transform((s) => (s && s.trim() !== "" ? s : undefined));
const optEmail = z.string().optional().transform((s, ctx) => {
  if (!s || s.trim() === "") return undefined;
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
  if (!ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email inválido" });
    return z.NEVER;
  }
  return s;
});

// ── Categoria ─────────────────────────────
export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nome muito curto").max(100),
  kind: z.enum(["RECEITA", "DESPESA"]),
});

// ── Centro de custo ────────────────────────
export const costCenterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
});

// ── Conta bancária ────────────────────────
export const bankAccountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
  type: z.enum(["CORRENTE", "POUPANCA", "DIGITAL", "GATEWAY", "CARTAO_CREDITO", "CAIXA_INTERNO"]),
  bank: optString,
  agency: optString,
  accountNumber: optString,
  openingBalance: numberFromStr,
  notes: optString,
});

// ── Fornecedor ────────────────────────────
export const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
  document: optString,
  email: optEmail,
  phone: optString,
  category: optString,
  bankInfo: optString,
  addressLine: optString,
  notes: optString,
});

// ── Produto ───────────────────────────────
export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(150),
  description: optString,
  type: z.enum(["CURSO", "MENTORIA", "ASSINATURA", "COMUNIDADE", "EVENTO", "CONSULTORIA", "TREINAMENTO", "PRODUTO_DIGITAL", "UPSELL", "DOWNSELL", "ORDER_BUMP"]),
  billing: z.enum(["UNICA", "RECORRENTE"]),
  defaultPrice: numberFromStr,
  estimatedCost: optNumberFromStr,
  estimatedMargin: optNumberFromStr,
  defaultCommissionPercent: optNumberFromStr,
  accessDurationDays: optInt,
  categoryId: optString,
  costCenterId: optString,
  notes: optString,
});

// ── Cliente / Aluno ───────────────────────
const originEnum = z.enum(["ORGANICO", "TRAFEGO_PAGO", "INDICACAO", "AFILIADO", "PARCEIRO", "EVENTO", "INBOUND", "OUTBOUND", "OUTRO"]);

export const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(150),
  email: optEmail,
  phone: optString,
  document: optString,
  company: optString,
  addressLine: optString,
  city: optString,
  state: optString,
  zip: optString,
  status: z.enum(["ATIVO", "INADIMPLENTE", "EM_NEGOCIACAO", "CANCELADO", "REEMBOLSADO", "EX_ALUNO"]),
  origin: z.string().optional().transform((s, ctx) => {
    if (!s || s.trim() === "") return undefined;
    const parsed = originEnum.safeParse(s);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Origem inválida" });
      return z.NEVER;
    }
    return parsed.data;
  }),
  notes: optString,
});

// ── Venda (Sale) ───────────────────────────
const dateFromInput = z.string().min(1, "Data obrigatória").transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inválida" });
    return z.NEVER;
  }
  return d;
});

const optDateFromInput = z.string().optional().transform((s, ctx) => {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inválida" });
    return z.NEVER;
  }
  return d;
});

const intFromStr = z.string().min(1).transform((s, ctx) => {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inteiro positivo" });
    return z.NEVER;
  }
  return n;
});

export const saleSchema = z.object({
  customerId: z.string().min(1, "Selecione um cliente"),
  productId: z.string().min(1, "Selecione um produto"),
  sellerId: optString,
  origin: z.enum(["ORGANICO", "TRAFEGO_PAGO", "INDICACAO", "AFILIADO", "PARCEIRO", "EVENTO", "INBOUND", "OUTBOUND", "OUTRO"]),
  saleDate: dateFromInput,
  grossAmount: numberFromStr,
  discountAmount: optNumberFromStr,
  feeAmount: optNumberFromStr,
  installmentsCount: intFromStr,
  firstDueDate: dateFromInput,
  paymentMethodId: optString,
  bankAccountId: optString,
  categoryId: optString,
  costCenterId: optString,
  commissionPercent: optNumberFromStr,
  notes: optString,
});

// ── Marcar parcela como paga ───────────────
export const markPaidSchema = z.object({
  installmentId: z.string().min(1),
  paidAt: dateFromInput,
  paidAmount: numberFromStr,
  bankAccountId: optString,
  paymentMethodId: optString,
});

// ── Alterar vencimento ────────────────────
export const changeDueDateSchema = z.object({
  installmentId: z.string().min(1),
  newDueDate: dateFromInput,
  reason: optString,
});

// ── Reembolso ─────────────────────────────
export const refundSchema = z.object({
  saleId: z.string().min(1),
  amount: numberFromStr,
  processedAt: dateFromInput,
  reason: optString,
});

// ── Assinatura ────────────────────────────
export const subscriptionSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1, "Selecione um cliente"),
  productId: z.string().min(1, "Selecione um produto"),
  amount: numberFromStr,
  period: z.enum(["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"]),
  startDate: dateFromInput,
  nextChargeAt: optDateFromInput,
  paymentMethodId: optString,
  expiresAt: optDateFromInput,
});

// ── Labels para UI ────────────────────────
export const productTypeLabel: Record<string, string> = {
  CURSO: "Curso online", MENTORIA: "Mentoria", ASSINATURA: "Assinatura",
  COMUNIDADE: "Comunidade", EVENTO: "Evento", CONSULTORIA: "Consultoria",
  TREINAMENTO: "Treinamento", PRODUTO_DIGITAL: "Produto digital",
  UPSELL: "Upsell", DOWNSELL: "Downsell", ORDER_BUMP: "Order bump",
};
export const productBillingLabel: Record<string, string> = {
  UNICA: "Única", RECORRENTE: "Recorrente",
};
export const bankAccountTypeLabel: Record<string, string> = {
  CORRENTE: "Conta corrente", POUPANCA: "Poupança", DIGITAL: "Digital",
  GATEWAY: "Gateway", CARTAO_CREDITO: "Cartão de crédito", CAIXA_INTERNO: "Caixa interno",
};
export const customerStatusLabel: Record<string, string> = {
  ATIVO: "Adimplente / Ativo", INADIMPLENTE: "Inadimplente",
  EM_NEGOCIACAO: "Em negociação", CANCELADO: "Cancelado",
  REEMBOLSADO: "Reembolsado", EX_ALUNO: "Ex-aluno",
};
export const saleOriginLabel: Record<string, string> = {
  ORGANICO: "Orgânico", TRAFEGO_PAGO: "Tráfego pago",
  INDICACAO: "Indicação", AFILIADO: "Afiliado", PARCEIRO: "Parceiro",
  EVENTO: "Evento", INBOUND: "Inbound", OUTBOUND: "Outbound", OUTRO: "Outro",
};
export const installmentStatusLabel: Record<string, string> = {
  PENDENTE: "Pendente", PAGO: "Pago", PARCIALMENTE_PAGO: "Parcial",
  VENCIDO: "Vencida", CANCELADO: "Cancelada", REEMBOLSADO: "Reembolsada",
  CHARGEBACK: "Chargeback", EM_NEGOCIACAO: "Em negociação",
};
export const subscriptionStatusLabel: Record<string, string> = {
  ATIVA: "Ativa", PENDENTE: "Pendente", INADIMPLENTE: "Inadimplente",
  CANCELADA: "Cancelada", PAUSADA: "Pausada", EXPIRADA: "Expirada",
};
export const subscriptionPeriodLabel: Record<string, string> = {
  MENSAL: "Mensal", TRIMESTRAL: "Trimestral", SEMESTRAL: "Semestral", ANUAL: "Anual",
};
export const saleStatusLabel: Record<string, string> = {
  ABERTA: "Aberta", CONCLUIDA: "Concluída", CANCELADA: "Cancelada",
  REEMBOLSADA: "Reembolsada", CHARGEBACK: "Chargeback",
};
