import { PageShell } from "@/components/layout/page-shell";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <PageShell title="Produtos & Ofertas" description="Cursos, mentorias, comunidades, eventos e mais.">
      <ComingSoon phase="Fase 2" what="Cadastro dos produtos ENTUR (Universidade Corporativa, Trekker, Agente Independente, OSA, Sirius, etc), preço padrão, comissão padrão, margem estimada e centro de custo." />
    </PageShell>
  );
}
