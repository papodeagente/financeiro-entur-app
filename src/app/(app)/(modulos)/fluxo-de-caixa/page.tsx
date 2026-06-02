import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Fluxo de caixa" description="Realizado e projetado por dia/semana/mês.">
      <ComingSoon phase="Fase 5" what="Saldo inicial → entradas/saídas previstas e realizadas → saldo final + projeção 30/60/90 dias considerando recebíveis, recorrências, despesas e inadimplência. Alertas de caixa negativo previsto." />
    </PageShell>
  );
}
