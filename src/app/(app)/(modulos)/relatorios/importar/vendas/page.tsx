import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { ImportSales } from "./_components/import-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sellers = await prisma.user.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <PageShell
      title="Importar vendas via CSV"
      description="Migração de histórico do Hotmart, Eduzz, Kiwify ou formato genérico. Vendas com PAGAS já entram com parcelas concluídas e créditos no histórico."
    >
      <Link href="/relatorios" className="btn-ghost text-sm">
        <ArrowLeft className="h-4 w-4" /> Todos os relatórios
      </Link>
      <ImportSales sellers={sellers} />
      <div className="card-soft p-4 space-y-3">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-ink-subtle font-semibold">Como obter o CSV</h3>
        </div>
        <div className="text-xs text-ink-muted space-y-2">
          <p><strong className="text-ink">Hotmart:</strong> Painel → Vendas → exportar relatório CSV/Excel.</p>
          <p><strong className="text-ink">Eduzz:</strong> Painel → Financeiro → Vendas → exportar.</p>
          <p><strong className="text-ink">Kiwify:</strong> Painel → Pedidos → exportar.</p>
          <p><strong className="text-ink">Genérico:</strong> CSV com colunas: <code>data, cliente, email, produto, valor, parcelas, taxa, liquido, pagamento, origem, id_externo, status</code>.</p>
        </div>
      </div>
    </PageShell>
  );
}
