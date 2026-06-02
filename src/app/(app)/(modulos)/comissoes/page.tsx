import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Comissões" description="Vendedores, consultores, afiliados e parceiros.">
      <ComingSoon phase="Fase 4" what="Comissão liberada só após pagamento do cliente; estorno em caso de reembolso/chargeback; % por produto e por vendedor; base bruto ou líquido configurável." />
    </PageShell>
  );
}
