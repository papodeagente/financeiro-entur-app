import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Parcelamentos" description="Vendas parceladas com acompanhamento individual.">
      <ComingSoon phase="Fase 3" what="Visão dedicada às vendas parceladas (ex: Mentoria Trekker 10× de R$ 2.000) com saldo devedor, renegociação, antecipação e pagamento parcial." />
    </PageShell>
  );
}
