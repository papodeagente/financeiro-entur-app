import { EmptyState } from "@/components/layout/page-shell";

export function ComingSoon({ phase, what }: { phase: string; what: string }) {
  return (
    <EmptyState
      title={`Disponível na ${phase}`}
      description={`${what} Os dados do dashboard já refletem este módulo quando começarmos a popular.`}
    />
  );
}
