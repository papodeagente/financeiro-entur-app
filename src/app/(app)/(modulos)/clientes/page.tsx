import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Clientes / Alunos" description="Cadastro financeiro dos clientes da ENTUR.">
      <ComingSoon phase="Fase 2" what="Cadastro com dados pessoais, status financeiro (adimplente, inadimplente, etc), histórico de compras e pagamentos, total comprado/pago/em atraso." />
    </PageShell>
  );
}
