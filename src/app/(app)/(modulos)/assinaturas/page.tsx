import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Assinaturas & Recorrências" description="Mensalidades e recorrências automáticas.">
      <ComingSoon phase="Fase 3" what="Controle de assinaturas (ativa/pausada/cancelada/inadimplente), geração automática de próximas cobranças, alertas de risco de churn." />
    </PageShell>
  );
}
