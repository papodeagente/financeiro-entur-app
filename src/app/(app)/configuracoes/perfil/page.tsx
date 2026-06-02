import { ChangePasswordForm } from "./_components/form";
import { PageShell } from "@/components/layout/page-shell";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <PageShell title="Meu perfil" description="Troque sua senha de acesso.">
      <div className="card p-6 max-w-md">
        <h3 className="text-sm font-semibold text-ink">Trocar senha</h3>
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}
