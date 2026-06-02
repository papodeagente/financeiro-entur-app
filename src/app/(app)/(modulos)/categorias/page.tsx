import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Categorias financeiras" description="Estrutura de DRE: receitas e despesas.">
      <ComingSoon phase="Fase 2" what="Categorias hierárquicas para classificar entradas e saídas — base da DRE e dos relatórios estratégicos." />
    </PageShell>
  );
}
