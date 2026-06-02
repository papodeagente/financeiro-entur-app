import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Centros de custo" description="Comercial, Marketing, Produto, Operação e mais.">
      <ComingSoon phase="Fase 2" what="Centros de custo da operação ENTUR — cada receita e despesa vincula a um centro para análise de rentabilidade por área." />
    </PageShell>
  );
}
