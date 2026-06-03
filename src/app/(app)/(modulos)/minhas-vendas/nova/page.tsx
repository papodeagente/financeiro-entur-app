import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { PageShell } from "@/components/layout/page-shell";
import { NewSaleForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireSession();

  const [customers, products, sellers, paymentMethods] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true, email: true, document: true, status: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true, defaultPrice: true, defaultCommissionPercent: true, billing: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <PageShell
      title="Lançar venda"
      description="Preencha tudo o que conseguir agora. O financeiro vai validar e gerar os recebíveis e a comissão."
    >
      <Link href="/minhas-vendas" className="btn-ghost text-sm">
        <ArrowLeft className="h-4 w-4" /> Minhas vendas
      </Link>
      <NewSaleForm
        customers={customers}
        products={products}
        users={sellers}
        paymentMethods={paymentMethods}
        currentUserId={session.user.id}
        currentUserName={session.user.name}
      />
    </PageShell>
  );
}
