import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Relatórios estratégicos" description="20 relatórios para tomada de decisão, com exportação CSV/Excel.">
      <ComingSoon phase="Fase 6" what="Receita/lucro por produto, canal, vendedor, origem; inadimplência por produto/cliente; despesas por categoria/centro; clientes mais valiosos; assinaturas ativas/canceladas/inadimplentes; previsão de recebimentos; e mais." />
    </PageShell>
  );
}
