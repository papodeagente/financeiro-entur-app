import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PageShell } from "@/components/layout/page-shell";
import { prisma } from "@/lib/db";
import { dateTimeBR } from "@/lib/format";
import Link from "next/link";
import { FileBarChart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, role: true, lastLoginAt: true, createdAt: true } })
    : null;

  return (
    <PageShell title="Configurações" description="Conta, usuários, permissões e integrações.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-ink">Meu perfil</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Nome" value={me?.name ?? "—"} />
            <Row label="Email" value={me?.email ?? "—"} />
            <Row label="Perfil" value={me?.role ?? "—"} />
            <Row label="Último acesso" value={dateTimeBR(me?.lastLoginAt)} />
            <Row label="Conta criada em" value={dateTimeBR(me?.createdAt)} />
          </dl>
          <p className="mt-6 text-xs text-ink-subtle">
            Convite de usuários, troca de senha por UI e integrações com Hotmart, Stripe, Asaas, Mercado Pago e Open Finance estão na roadmap após esta versão.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-ink">Identidade</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Empresa" value="Escola de Negócios do Turismo (ENTUR)" />
            <Row label="Sistema" value="Financeiro ENTUR" />
            <Row label="Versão" value="v1.0 — sistema completo (Fases 1-6)" />
          </dl>
          <div className="mt-6">
            <Link href="/configuracoes/auditoria" className="btn-secondary inline-flex">
              <FileBarChart className="h-4 w-4" /> Ver log de auditoria
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
