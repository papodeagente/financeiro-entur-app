import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Receitas" description="Cadastro de vendas e geração automática de parcelas.">
      <ComingSoon phase="Fase 3" what="Cadastro de receitas (única ou parcelada), vínculo com cliente/produto/categoria, status financeiro, anexos e link de transação." />
    </PageShell>
  );
}
