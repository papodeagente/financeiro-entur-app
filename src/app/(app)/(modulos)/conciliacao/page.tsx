import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Conciliação financeira" description="Bruto × taxas × líquido × extrato bancário.">
      <ComingSoon phase="Fase 5" what="Comparar vendas registradas com recebimentos efetivos no banco, identificar divergências e marcar como conciliado." />
    </PageShell>
  );
}
