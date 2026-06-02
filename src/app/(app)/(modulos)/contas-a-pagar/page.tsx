import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Contas a pagar" description="Pagamentos pendentes e agendados.">
      <ComingSoon phase="Fase 4" what="Listagem de despesas a pagar com alertas de vencimento, ações de marcar pago, anexar comprovante, reagendar, duplicar." />
    </PageShell>
  );
}
