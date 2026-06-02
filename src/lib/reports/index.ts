import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { brl, dateBR, pct } from "@/lib/format";
import { saleOriginLabel, subscriptionStatusLabel, customerStatusLabel } from "@/lib/validations";
import { syncOverdueInstallments, syncOverdueExpenses } from "@/lib/finance-ops";
import type { CsvColumn } from "@/lib/csv";

const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

export type ReportRowGeneric = Record<string, string | number | Date | null | undefined>;

export type ReportDef<R extends ReportRowGeneric = ReportRowGeneric> = {
  slug: string;
  group: "Receita" | "Inadimplência" | "Despesas" | "Comissões" | "Clientes & Produtos" | "Fluxo & Recebimento" | "Assinaturas";
  name: string;
  description: string;
  csvColumns: CsvColumn<R>[];
  uiColumns: { header: string; key: keyof R; cell?: (row: R) => ReactNode; align?: "left" | "right"; width?: string }[];
  totalsLine?: (rows: R[]) => Record<string, string | number>;
  load: (filters: ReportFilters) => Promise<R[]>;
};

export type ReportFilters = { from?: Date; to?: Date };

function defaultRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

export function effectiveRange(f: ReportFilters): { from: Date; to: Date } {
  const def = defaultRange();
  return { from: f.from ?? def.from, to: f.to ?? def.to };
}

// ─────────────────────────────────────────
// Relatórios
// ─────────────────────────────────────────

const receitaPorProduto: ReportDef = {
  slug: "receita-por-produto",
  group: "Receita",
  name: "Receita por produto",
  description: "Receita bruta e líquida por produto vendido no período.",
  uiColumns: [
    { header: "Produto", key: "produto" },
    { header: "Vendas", key: "vendas", align: "right", width: "100px" },
    { header: "Receita bruta", key: "bruto", align: "right", width: "160px" },
    { header: "Receita líquida", key: "liquido", align: "right", width: "160px" },
  ],
  csvColumns: [
    { key: "produto", header: "Produto", render: (r) => r.produto as string },
    { key: "vendas", header: "Vendas", render: (r) => r.vendas as number },
    { key: "bruto_raw", header: "Receita bruta (R$)", render: (r) => Number(r.bruto_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "liquido_raw", header: "Receita líquida (R$)", render: (r) => Number(r.liquido_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  totalsLine: (rows) => ({
    produto: "TOTAL",
    vendas: rows.reduce((a, r) => a + Number(r.vendas), 0),
    bruto: brl(rows.reduce((a, r) => a + Number(r.bruto_raw ?? 0), 0)),
    liquido: brl(rows.reduce((a, r) => a + Number(r.liquido_raw ?? 0), 0)),
  }),
  load: async (f) => {
    const { from, to } = effectiveRange(f);
    const groups = await prisma.sale.groupBy({
      by: ["productId"], _sum: { grossAmount: true, netAmount: true }, _count: true,
      where: { saleDate: { gte: from, lt: to }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
      orderBy: { _sum: { netAmount: "desc" } },
    });
    const ids = groups.map((g) => g.productId);
    const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return groups.map((g) => {
      const p = products.find((x) => x.id === g.productId);
      const bruto = num(g._sum.grossAmount);
      const liquido = num(g._sum.netAmount);
      return { produto: p?.name ?? "?", vendas: g._count, bruto: brl(bruto), liquido: brl(liquido), bruto_raw: bruto, liquido_raw: liquido };
    });
  },
};

const receitaPorOrigem: ReportDef = {
  slug: "receita-por-origem",
  group: "Receita",
  name: "Receita por canal de origem",
  description: "Receita líquida agrupada pela origem da venda.",
  uiColumns: [
    { header: "Origem", key: "origem" },
    { header: "Vendas", key: "vendas", align: "right", width: "100px" },
    { header: "Receita líquida", key: "liquido", align: "right", width: "160px" },
    { header: "Ticket médio", key: "ticket", align: "right", width: "140px" },
  ],
  csvColumns: [
    { key: "origem", header: "Origem", render: (r) => r.origem as string },
    { key: "vendas", header: "Vendas", render: (r) => r.vendas as number },
    { key: "liquido_raw", header: "Receita líquida (R$)", render: (r) => Number(r.liquido_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "ticket_raw", header: "Ticket médio (R$)", render: (r) => Number(r.ticket_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async (f) => {
    const { from, to } = effectiveRange(f);
    const groups = await prisma.sale.groupBy({
      by: ["origin"], _sum: { netAmount: true }, _avg: { netAmount: true }, _count: true,
      where: { saleDate: { gte: from, lt: to }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
      orderBy: { _sum: { netAmount: "desc" } },
    });
    return groups.map((g) => {
      const liquido = num(g._sum.netAmount);
      const ticket = num(g._avg.netAmount);
      return { origem: saleOriginLabel[g.origin], vendas: g._count, liquido: brl(liquido), ticket: brl(ticket), liquido_raw: liquido, ticket_raw: ticket };
    });
  },
};

const receitaPorVendedor: ReportDef = {
  slug: "receita-por-vendedor",
  group: "Receita",
  name: "Receita por vendedor",
  description: "Vendas, receita e ticket médio por vendedor responsável.",
  uiColumns: [
    { header: "Vendedor", key: "vendedor" },
    { header: "Vendas", key: "vendas", align: "right", width: "100px" },
    { header: "Receita líquida", key: "liquido", align: "right", width: "160px" },
    { header: "Ticket médio", key: "ticket", align: "right", width: "140px" },
  ],
  csvColumns: [
    { key: "vendedor", header: "Vendedor", render: (r) => r.vendedor as string },
    { key: "vendas", header: "Vendas", render: (r) => r.vendas as number },
    { key: "liquido_raw", header: "Receita líquida (R$)", render: (r) => Number(r.liquido_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "ticket_raw", header: "Ticket médio (R$)", render: (r) => Number(r.ticket_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async (f) => {
    const { from, to } = effectiveRange(f);
    const groups = await prisma.sale.groupBy({
      by: ["sellerId"], _sum: { netAmount: true }, _avg: { netAmount: true }, _count: true,
      where: { saleDate: { gte: from, lt: to }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] }, sellerId: { not: null } },
      orderBy: { _sum: { netAmount: "desc" } },
    });
    const ids = groups.map((g) => g.sellerId).filter((x): x is string => !!x);
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return groups.map((g) => {
      const u = users.find((x) => x.id === g.sellerId);
      const liquido = num(g._sum.netAmount);
      const ticket = num(g._avg.netAmount);
      return { vendedor: u?.name ?? "?", vendas: g._count, liquido: brl(liquido), ticket: brl(ticket), liquido_raw: liquido, ticket_raw: ticket };
    });
  },
};

const inadimplenciaPorProduto: ReportDef = {
  slug: "inadimplencia-por-produto",
  group: "Inadimplência",
  name: "Inadimplência por produto",
  description: "Parcelas vencidas (saldo em aberto) agrupadas por produto vendido.",
  uiColumns: [
    { header: "Produto", key: "produto" },
    { header: "Parcelas vencidas", key: "parcelas", align: "right", width: "140px" },
    { header: "Total em atraso", key: "atraso", align: "right", width: "180px" },
  ],
  csvColumns: [
    { key: "produto", header: "Produto", render: (r) => r.produto as string },
    { key: "parcelas", header: "Parcelas vencidas", render: (r) => r.parcelas as number },
    { key: "atraso_raw", header: "Total em atraso (R$)", render: (r) => Number(r.atraso_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async () => {
    await syncOverdueInstallments();
    const overdue = await prisma.revenueInstallment.findMany({
      where: { deletedAt: null, status: "VENCIDO" },
      include: { sale: { select: { product: { select: { name: true } } } } },
    });
    const map = new Map<string, { count: number; amount: number }>();
    for (const i of overdue) {
      const k = i.sale.product.name;
      const prev = map.get(k) ?? { count: 0, amount: 0 };
      prev.count += 1;
      prev.amount += Number(i.amount) - Number(i.paidAmount);
      map.set(k, prev);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([produto, v]) => ({ produto, parcelas: v.count, atraso: brl(v.amount), atraso_raw: v.amount }));
  },
};

const inadimplenciaPorCliente: ReportDef = {
  slug: "inadimplencia-por-cliente",
  group: "Inadimplência",
  name: "Inadimplência por cliente",
  description: "Clientes com parcelas vencidas, ordenados pelo valor em atraso.",
  uiColumns: [
    { header: "Cliente", key: "cliente" },
    { header: "Parcelas vencidas", key: "parcelas", align: "right", width: "140px" },
    { header: "Pior atraso (dias)", key: "atrasoDias", align: "right", width: "140px" },
    { header: "Total em atraso", key: "atraso", align: "right", width: "180px" },
  ],
  csvColumns: [
    { key: "cliente", header: "Cliente", render: (r) => r.cliente as string },
    { key: "parcelas", header: "Parcelas vencidas", render: (r) => r.parcelas as number },
    { key: "atrasoDias", header: "Pior atraso (dias)", render: (r) => r.atrasoDias as number },
    { key: "atraso_raw", header: "Total em atraso (R$)", render: (r) => Number(r.atraso_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async () => {
    await syncOverdueInstallments();
    const overdue = await prisma.revenueInstallment.findMany({
      where: { deletedAt: null, status: "VENCIDO" },
      include: { sale: { select: { customer: { select: { id: true, name: true } } } } },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const map = new Map<string, { name: string; count: number; amount: number; worst: number }>();
    for (const i of overdue) {
      const c = i.sale.customer;
      const days = Math.floor((today.getTime() - new Date(i.dueDate).getTime()) / 86400000);
      const prev = map.get(c.id) ?? { name: c.name, count: 0, amount: 0, worst: 0 };
      prev.count += 1;
      prev.amount += Number(i.amount) - Number(i.paidAmount);
      prev.worst = Math.max(prev.worst, days);
      map.set(c.id, prev);
    }
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ cliente: c.name, parcelas: c.count, atrasoDias: c.worst, atraso: brl(c.amount), atraso_raw: c.amount }));
  },
};

const despesasPorCategoria: ReportDef = {
  slug: "despesas-por-categoria",
  group: "Despesas",
  name: "Despesas por categoria",
  description: "Despesas agrupadas por categoria no período (regime de competência).",
  uiColumns: [
    { header: "Categoria", key: "categoria" },
    { header: "Lançamentos", key: "qtd", align: "right", width: "120px" },
    { header: "Total", key: "total", align: "right", width: "180px" },
  ],
  csvColumns: [
    { key: "categoria", header: "Categoria", render: (r) => r.categoria as string },
    { key: "qtd", header: "Lançamentos", render: (r) => r.qtd as number },
    { key: "total_raw", header: "Total (R$)", render: (r) => Number(r.total_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async (f) => {
    const { from, to } = effectiveRange(f);
    const groups = await prisma.expense.groupBy({
      by: ["categoryId"], _sum: { amount: true }, _count: true,
      where: { competenceDate: { gte: from, lt: to }, deletedAt: null, status: { not: "CANCELADO" } },
      orderBy: { _sum: { amount: "desc" } },
    });
    const ids = groups.map((g) => g.categoryId).filter((x): x is string => !!x);
    const cats = ids.length ? await prisma.financialCategory.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return groups.map((g) => {
      const c = g.categoryId ? cats.find((x) => x.id === g.categoryId)?.name : null;
      const total = num(g._sum.amount);
      return { categoria: c ?? "Sem categoria", qtd: g._count, total: brl(total), total_raw: total };
    });
  },
};

const despesasPorCentroCusto: ReportDef = {
  slug: "despesas-por-centro-custo",
  group: "Despesas",
  name: "Despesas por centro de custo",
  description: "Despesas agrupadas por centro de custo no período.",
  uiColumns: [
    { header: "Centro de custo", key: "centro" },
    { header: "Lançamentos", key: "qtd", align: "right", width: "120px" },
    { header: "Total", key: "total", align: "right", width: "180px" },
  ],
  csvColumns: [
    { key: "centro", header: "Centro de custo", render: (r) => r.centro as string },
    { key: "qtd", header: "Lançamentos", render: (r) => r.qtd as number },
    { key: "total_raw", header: "Total (R$)", render: (r) => Number(r.total_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async (f) => {
    const { from, to } = effectiveRange(f);
    const groups = await prisma.expense.groupBy({
      by: ["costCenterId"], _sum: { amount: true }, _count: true,
      where: { competenceDate: { gte: from, lt: to }, deletedAt: null, status: { not: "CANCELADO" } },
      orderBy: { _sum: { amount: "desc" } },
    });
    const ids = groups.map((g) => g.costCenterId).filter((x): x is string => !!x);
    const ccs = ids.length ? await prisma.costCenter.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return groups.map((g) => {
      const c = g.costCenterId ? ccs.find((x) => x.id === g.costCenterId)?.name : null;
      const total = num(g._sum.amount);
      return { centro: c ?? "Sem centro", qtd: g._count, total: brl(total), total_raw: total };
    });
  },
};

const comissoesAPagar: ReportDef = {
  slug: "comissoes-a-pagar",
  group: "Comissões",
  name: "Comissões a pagar",
  description: "Comissões liberadas ou pendentes — agrupadas por beneficiário.",
  uiColumns: [
    { header: "Beneficiário", key: "payee" },
    { header: "Liberadas (qtd)", key: "qtdLib", align: "right", width: "120px" },
    { header: "Pendentes (qtd)", key: "qtdPend", align: "right", width: "120px" },
    { header: "A pagar agora", key: "lib", align: "right", width: "160px" },
    { header: "Aguardando pgto. cliente", key: "pend", align: "right", width: "180px" },
  ],
  csvColumns: [
    { key: "payee", header: "Beneficiário", render: (r) => r.payee as string },
    { key: "qtdLib", header: "Comissões liberadas (qtd)", render: (r) => r.qtdLib as number },
    { key: "qtdPend", header: "Comissões pendentes (qtd)", render: (r) => r.qtdPend as number },
    { key: "lib_raw", header: "A pagar agora (R$)", render: (r) => Number(r.lib_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "pend_raw", header: "Aguardando pgto cliente (R$)", render: (r) => Number(r.pend_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async () => {
    const liberated = await prisma.commission.groupBy({
      by: ["payeeId"], _sum: { amount: true }, _count: true, where: { status: "LIBERADA" },
    });
    const pending = await prisma.commission.groupBy({
      by: ["payeeId"], _sum: { amount: true }, _count: true, where: { status: "PENDENTE" },
    });
    const ids = Array.from(new Set([...liberated.map((g) => g.payeeId), ...pending.map((g) => g.payeeId)]));
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const map = new Map<string, { payee: string; qtdLib: number; qtdPend: number; lib: number; pend: number }>();
    for (const g of liberated) {
      const u = users.find((x) => x.id === g.payeeId);
      const prev = map.get(g.payeeId) ?? { payee: u?.name ?? "?", qtdLib: 0, qtdPend: 0, lib: 0, pend: 0 };
      prev.qtdLib = g._count;
      prev.lib = num(g._sum.amount);
      map.set(g.payeeId, prev);
    }
    for (const g of pending) {
      const u = users.find((x) => x.id === g.payeeId);
      const prev = map.get(g.payeeId) ?? { payee: u?.name ?? "?", qtdLib: 0, qtdPend: 0, lib: 0, pend: 0 };
      prev.qtdPend = g._count;
      prev.pend = num(g._sum.amount);
      map.set(g.payeeId, prev);
    }
    return Array.from(map.values())
      .sort((a, b) => (b.lib + b.pend) - (a.lib + a.pend))
      .map((v) => ({ payee: v.payee, qtdLib: v.qtdLib, qtdPend: v.qtdPend, lib: brl(v.lib), pend: brl(v.pend), lib_raw: v.lib, pend_raw: v.pend }));
  },
};

const reembolsosChargebacks: ReportDef = {
  slug: "reembolsos-chargebacks",
  group: "Receita",
  name: "Reembolsos e chargebacks",
  description: "Reembolsos processados e chargebacks disputados no período.",
  uiColumns: [
    { header: "Tipo", key: "tipo" },
    { header: "Cliente", key: "cliente" },
    { header: "Data", key: "data", width: "120px" },
    { header: "Valor", key: "valor", align: "right", width: "160px" },
    { header: "Motivo", key: "motivo" },
  ],
  csvColumns: [
    { key: "tipo", header: "Tipo", render: (r) => r.tipo as string },
    { key: "cliente", header: "Cliente", render: (r) => r.cliente as string },
    { key: "data", header: "Data", render: (r) => r.data as string },
    { key: "valor_raw", header: "Valor (R$)", render: (r) => Number(r.valor_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "motivo", header: "Motivo", render: (r) => (r.motivo as string) ?? "" },
  ],
  load: async (f) => {
    const { from, to } = effectiveRange(f);
    const [refunds, chargebacks] = await Promise.all([
      prisma.refund.findMany({ where: { processedAt: { gte: from, lt: to } }, include: { customer: { select: { name: true } } }, orderBy: { processedAt: "desc" } }),
      prisma.chargeback.findMany({ where: { disputedAt: { gte: from, lt: to } }, include: { customer: { select: { name: true } } }, orderBy: { disputedAt: "desc" } }),
    ]);
    return [
      ...refunds.map((r) => ({ tipo: "Reembolso", cliente: r.customer.name, data: dateBR(r.processedAt), valor: brl(r.amount), motivo: r.reason ?? "", valor_raw: num(r.amount) })),
      ...chargebacks.map((c) => ({ tipo: "Chargeback", cliente: c.customer.name, data: dateBR(c.disputedAt), valor: brl(c.amount), motivo: c.reason ?? "", valor_raw: num(c.amount) })),
    ].sort((a, b) => Number(b.valor_raw) - Number(a.valor_raw));
  },
};

const clientesMaisValiosos: ReportDef = {
  slug: "clientes-mais-valiosos",
  group: "Clientes & Produtos",
  name: "Clientes mais valiosos (LTV)",
  description: "Clientes ordenados por receita líquida total (todos os tempos).",
  uiColumns: [
    { header: "Cliente", key: "cliente" },
    { header: "Status", key: "status", width: "180px" },
    { header: "Vendas", key: "vendas", align: "right", width: "100px" },
    { header: "Receita total", key: "total", align: "right", width: "160px" },
    { header: "Primeira compra", key: "primeira", width: "140px" },
    { header: "Última compra", key: "ultima", width: "140px" },
  ],
  csvColumns: [
    { key: "cliente", header: "Cliente", render: (r) => r.cliente as string },
    { key: "status", header: "Status financeiro", render: (r) => r.status as string },
    { key: "vendas", header: "Vendas", render: (r) => r.vendas as number },
    { key: "total_raw", header: "Receita total (R$)", render: (r) => Number(r.total_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "primeira", header: "Primeira compra", render: (r) => r.primeira as string },
    { key: "ultima", header: "Última compra", render: (r) => r.ultima as string },
  ],
  load: async () => {
    const groups = await prisma.sale.groupBy({
      by: ["customerId"], _sum: { netAmount: true }, _count: true,
      where: { deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
      orderBy: { _sum: { netAmount: "desc" } }, take: 100,
    });
    const ids = groups.map((g) => g.customerId);
    const customers = ids.length ? await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, status: true, firstPurchaseAt: true, lastPurchaseAt: true } }) : [];
    return groups.map((g) => {
      const c = customers.find((x) => x.id === g.customerId);
      const total = num(g._sum.netAmount);
      return {
        cliente: c?.name ?? "?",
        status: customerStatusLabel[c?.status ?? "ATIVO"] ?? "?",
        vendas: g._count,
        total: brl(total),
        primeira: dateBR(c?.firstPurchaseAt),
        ultima: dateBR(c?.lastPurchaseAt),
        total_raw: total,
      };
    });
  },
};

const vendasParceladasAbertas: ReportDef = {
  slug: "vendas-parceladas-em-aberto",
  group: "Fluxo & Recebimento",
  name: "Vendas parceladas em aberto",
  description: "Vendas com 2+ parcelas que ainda têm saldo devedor.",
  uiColumns: [
    { header: "Cliente / Produto", key: "cliente" },
    { header: "Parcelas", key: "parcelas", align: "right", width: "120px" },
    { header: "Total", key: "total", align: "right", width: "140px" },
    { header: "Pago", key: "pago", align: "right", width: "140px" },
    { header: "Saldo devedor", key: "saldo", align: "right", width: "160px" },
  ],
  csvColumns: [
    { key: "cliente", header: "Cliente", render: (r) => r.cliente as string },
    { key: "produto", header: "Produto", render: (r) => r.produto as string },
    { key: "parcelas", header: "Parcelas (pagas/total)", render: (r) => r.parcelas as string },
    { key: "total_raw", header: "Total venda (R$)", render: (r) => Number(r.total_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "pago_raw", header: "Pago (R$)", render: (r) => Number(r.pago_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "saldo_raw", header: "Saldo devedor (R$)", render: (r) => Number(r.saldo_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async () => {
    const sales = await prisma.sale.findMany({
      where: { deletedAt: null, installmentsCount: { gt: 1 }, status: { in: ["ABERTA"] } },
      include: {
        customer: { select: { name: true } }, product: { select: { name: true } },
        installments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true, status: true } },
      },
      take: 200,
    });
    return sales.map((s) => {
      const total = num(s.netAmount);
      const pago = s.installments.reduce((a, i) => a + num(i.paidAmount), 0);
      const saldo = +(total - pago).toFixed(2);
      const pagas = s.installments.filter((i) => i.status === "PAGO").length;
      return {
        cliente: `${s.customer.name} · ${s.product.name}`, produto: s.product.name,
        parcelas: `${pagas}/${s.installmentsCount}`,
        total: brl(total), pago: brl(pago), saldo: brl(saldo),
        total_raw: total, pago_raw: pago, saldo_raw: saldo,
      };
    }).sort((a, b) => Number(b.saldo_raw) - Number(a.saldo_raw));
  },
};

const assinaturasStatus: ReportDef = {
  slug: "assinaturas-status",
  group: "Assinaturas",
  name: "Assinaturas — ativas, canceladas e inadimplentes",
  description: "Visão geral das assinaturas e seu status.",
  uiColumns: [
    { header: "Cliente / Produto", key: "cliente" },
    { header: "Valor", key: "valor", align: "right", width: "120px" },
    { header: "Período", key: "periodo", width: "120px" },
    { header: "Status", key: "status", width: "160px" },
    { header: "Próx. cobrança", key: "prox", width: "140px" },
  ],
  csvColumns: [
    { key: "cliente", header: "Cliente", render: (r) => r.cliente as string },
    { key: "produto", header: "Produto", render: (r) => r.produto as string },
    { key: "valor_raw", header: "Valor (R$)", render: (r) => Number(r.valor_raw ?? 0).toFixed(2).replace(".", ",") },
    { key: "periodo", header: "Período", render: (r) => r.periodo as string },
    { key: "status", header: "Status", render: (r) => r.status as string },
    { key: "prox", header: "Próxima cobrança", render: (r) => r.prox as string },
  ],
  load: async () => {
    const subs = await prisma.subscription.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { name: true } }, product: { select: { name: true } } },
      orderBy: { status: "asc" },
    });
    return subs.map((s) => ({
      cliente: `${s.customer.name} · ${s.product.name}`, produto: s.product.name,
      valor: brl(s.amount), periodo: s.period, status: subscriptionStatusLabel[s.status],
      prox: dateBR(s.nextChargeAt), valor_raw: num(s.amount),
    }));
  },
};

const contasVencidas: ReportDef = {
  slug: "contas-vencidas",
  group: "Fluxo & Recebimento",
  name: "Contas vencidas (a receber e a pagar)",
  description: "Recebíveis e pagáveis em atraso.",
  uiColumns: [
    { header: "Tipo", key: "tipo", width: "100px" },
    { header: "Descrição", key: "descricao" },
    { header: "Vencimento", key: "venc", width: "120px" },
    { header: "Dias em atraso", key: "dias", align: "right", width: "120px" },
    { header: "Valor em aberto", key: "valor", align: "right", width: "160px" },
  ],
  csvColumns: [
    { key: "tipo", header: "Tipo", render: (r) => r.tipo as string },
    { key: "descricao", header: "Descrição", render: (r) => r.descricao as string },
    { key: "venc", header: "Vencimento", render: (r) => r.venc as string },
    { key: "dias", header: "Dias em atraso", render: (r) => r.dias as number },
    { key: "valor_raw", header: "Valor em aberto (R$)", render: (r) => Number(r.valor_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async () => {
    await Promise.all([syncOverdueInstallments(), syncOverdueExpenses()]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [installments, expenses] = await Promise.all([
      prisma.revenueInstallment.findMany({
        where: { deletedAt: null, status: "VENCIDO" },
        include: { sale: { select: { customer: { select: { name: true } }, product: { select: { name: true } } } } },
      }),
      prisma.expense.findMany({ where: { deletedAt: null, status: "VENCIDO" }, include: { supplier: { select: { name: true } } } }),
    ]);
    const recebidas = installments.map((i) => {
      const open = num(i.amount) - num(i.paidAmount);
      const dias = Math.floor((today.getTime() - new Date(i.dueDate).getTime()) / 86400000);
      return { tipo: "A receber", descricao: `${i.sale.customer.name} · ${i.sale.product.name}`, venc: dateBR(i.dueDate), dias, valor: brl(open), valor_raw: open };
    });
    const pagaveis = expenses.map((e) => {
      const dias = Math.floor((today.getTime() - new Date(e.dueDate).getTime()) / 86400000);
      const valor = num(e.amount);
      return { tipo: "A pagar", descricao: `${e.description}${e.supplier ? ` · ${e.supplier.name}` : ""}`, venc: dateBR(e.dueDate), dias, valor: brl(valor), valor_raw: valor };
    });
    return [...recebidas, ...pagaveis].sort((a, b) => Number(b.valor_raw) - Number(a.valor_raw));
  },
};

const previsaoRecebimentos: ReportDef = {
  slug: "previsao-recebimentos",
  group: "Fluxo & Recebimento",
  name: "Previsão de recebimentos (90 dias)",
  description: "Parcelas a vencer nos próximos 90 dias.",
  uiColumns: [
    { header: "Cliente / Produto", key: "descricao" },
    { header: "Parcela", key: "parcela", width: "100px" },
    { header: "Vencimento", key: "venc", width: "120px" },
    { header: "Valor", key: "valor", align: "right", width: "160px" },
  ],
  csvColumns: [
    { key: "descricao", header: "Cliente / Produto", render: (r) => r.descricao as string },
    { key: "parcela", header: "Parcela", render: (r) => r.parcela as string },
    { key: "venc", header: "Vencimento", render: (r) => r.venc as string },
    { key: "valor_raw", header: "Valor (R$)", render: (r) => Number(r.valor_raw ?? 0).toFixed(2).replace(".", ",") },
  ],
  load: async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in90 = new Date(today); in90.setDate(in90.getDate() + 90);
    const list = await prisma.revenueInstallment.findMany({
      where: { deletedAt: null, dueDate: { gte: today, lt: in90 }, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO"] } },
      include: { sale: { select: { installmentsCount: true, customer: { select: { name: true } }, product: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    });
    return list.map((i) => {
      const open = num(i.amount) - num(i.paidAmount);
      return { descricao: `${i.sale.customer.name} · ${i.sale.product.name}`, parcela: `${i.number}/${i.sale.installmentsCount}`, venc: dateBR(i.dueDate), valor: brl(open), valor_raw: open };
    });
  },
};

export const reports: ReportDef[] = [
  receitaPorProduto, receitaPorOrigem, receitaPorVendedor, reembolsosChargebacks,
  inadimplenciaPorProduto, inadimplenciaPorCliente,
  despesasPorCategoria, despesasPorCentroCusto,
  comissoesAPagar,
  clientesMaisValiosos,
  assinaturasStatus,
  vendasParceladasAbertas, contasVencidas, previsaoRecebimentos,
];

export const reportBySlug = new Map(reports.map((r) => [r.slug, r]));
