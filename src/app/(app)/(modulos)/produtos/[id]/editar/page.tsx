import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { ProductForm } from "../../_components/product-form";
import type { ProductRow } from "../../_components/form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireWrite();
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product || product.deletedAt) notFound();

  const [categories, costCenters] = await Promise.all([
    prisma.financialCategory.findMany({ where: { kind: "RECEITA", active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const initial: ProductRow = {
    id: product.id, name: product.name, description: product.description,
    type: product.type, billing: product.billing,
    defaultPrice: product.defaultPrice.toString(),
    estimatedCost: product.estimatedCost?.toString() ?? null,
    estimatedMargin: product.estimatedMargin?.toString() ?? null,
    defaultCommissionPercent: product.defaultCommissionPercent?.toString() ?? null,
    accessDurationDays: product.accessDurationDays,
    categoryId: product.categoryId, costCenterId: product.costCenterId,
    active: product.active, notes: product.notes,
  };

  return (
    <div className="px-6 py-0 max-w-6xl mx-auto pb-12">
      <ProductForm initial={initial} categories={categories} costCenters={costCenters} />
    </div>
  );
}
