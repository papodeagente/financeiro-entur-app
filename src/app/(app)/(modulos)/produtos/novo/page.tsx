import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { ProductForm } from "../_components/product-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireWrite();
  const [categories, costCenters] = await Promise.all([
    prisma.financialCategory.findMany({ where: { kind: "RECEITA", active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="px-6 py-0 max-w-6xl mx-auto pb-12">
      <ProductForm categories={categories} costCenters={costCenters} />
    </div>
  );
}
