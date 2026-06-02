import type { UserRole, Prisma } from "@prisma/client";

const sellerOnlyRoles: UserRole[] = ["COMERCIAL", "CONSULTOR"];

export function isSellerOnly(role: UserRole) {
  return sellerOnlyRoles.includes(role);
}

/**
 * Aplica filtro de escopo nas vendas: Comercial/Consultor só vê suas próprias.
 */
export function saleScope(role: UserRole, userId: string): Prisma.SaleWhereInput {
  return isSellerOnly(role) ? { sellerId: userId } : {};
}

export function installmentScope(role: UserRole, userId: string): Prisma.RevenueInstallmentWhereInput {
  return isSellerOnly(role) ? { sale: { sellerId: userId } } : {};
}

export function commissionScope(role: UserRole, userId: string): Prisma.CommissionWhereInput {
  return isSellerOnly(role) ? { payeeId: userId } : {};
}

export function customerScope(role: UserRole, userId: string): Prisma.CustomerWhereInput {
  return isSellerOnly(role) ? { sales: { some: { sellerId: userId } } } : {};
}

export function subscriptionScope(role: UserRole, userId: string): Prisma.SubscriptionWhereInput {
  return isSellerOnly(role) ? { customer: { sales: { some: { sellerId: userId } } } } : {};
}
