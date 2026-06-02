import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Despesas" description="Despesas únicas e recorrentes da operação.">
      <ComingSoon phase="Fase 4" what="Cadastro de despesa única ou recorrente (mensal/trimestral/semestral/anual), com fornecedor, categoria, centro de custo, conta bancária e comprovante." />
    </PageShell>
  );
}
