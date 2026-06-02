import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Contas bancárias" description="Contas, gateways e caixa interno.">
      <ComingSoon phase="Fase 2" what="Conta corrente, poupança, digital, gateway de pagamento, cartão de crédito, caixa interno — com transferências internas e saldo em tempo real." />
    </PageShell>
  );
}
