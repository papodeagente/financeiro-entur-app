import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Fornecedores" description="SaaS, prestadores, agências, freelancers.">
      <ComingSoon phase="Fase 2" what="Cadastro de fornecedores com dados bancários, categoria e histórico de pagamentos." />
    </PageShell>
  );
}
