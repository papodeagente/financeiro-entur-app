import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Inadimplência" description="Estratégia de cobrança e recuperação.">
      <ComingSoon phase="Fase 3" what="Faixas de atraso (1-7, 8-15, 16-30, 31-60, 61-90, 90+), inadimplência por produto/vendedor/forma de pagamento, ações de cobrança, promessa de pagamento, suspensão de acesso." />
    </PageShell>
  );
}
