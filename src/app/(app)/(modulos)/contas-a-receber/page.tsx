import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Contas a receber" description="Parcelas, mensalidades e receitas futuras.">
      <ComingSoon phase="Fase 3" what="Listagem de parcelas com filtros (vencidas, hoje, próximos 7/30 dias, por produto/vendedor/cliente), ações rápidas de marcar como pago, renegociar, cobrar." />
    </PageShell>
  );
}
