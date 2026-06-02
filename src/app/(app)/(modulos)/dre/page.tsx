import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="DRE gerencial" description="Demonstrativo de resultados por regime de competência.">
      <ComingSoon phase="Fase 5" what="Receita Bruta → Reembolsos/Chargebacks/Taxas → Receita Líquida → Custos diretos → Margem Bruta → Despesas Comerciais/Marketing/Operacional/Equipe/Tecnologia → Resultado Operacional → Impostos → Lucro Líquido. Filtros por mês/trimestre/ano/produto/centro/categoria e comparação entre períodos." />
    </PageShell>
  );
}
