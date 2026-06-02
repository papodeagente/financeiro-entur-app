import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PageShell } from "@/components/layout/page-shell";
import { prisma } from "@/lib/db";
import { dateTimeBR } from "@/lib/format";
import Link from "next/link";
import { FileBarChart, Users, Target, KeyRound, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, role: true, lastLoginAt: true, createdAt: true } })
    : null;
  const isAdmin = session?.user.role === "ADMIN";
  const canManageGoals = isAdmin || session?.user.role === "GESTOR";

  const links = [
    { href: "/configuracoes/perfil", icon: KeyRound, label: "Trocar minha senha", description: "Atualize sua senha de acesso." },
    isAdmin && { href: "/configuracoes/usuarios", icon: Users, label: "Usuários", description: "Convidar, desativar, gerenciar acesso." },
    canManageGoals && { href: "/configuracoes/metas", icon: Target, label: "Metas de vendas", description: "Definir meta mensal por vendedor." },
    isAdmin && { href: "/configuracoes/auditoria", icon: FileBarChart, label: "Log de auditoria", description: "Histórico de alterações financeiras." },
  ].filter(Boolean) as { href: string; icon: typeof Users; label: string; description: string }[];

  return (
    <PageShell title="Configurações" description="Conta, usuários, permissões.">
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
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-ink">ENTUR</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Empresa" value="Escola de Negócios do Turismo" />
            <Row label="Sistema" value="Financeiro ENTUR" />
            <Row label="Versão" value="v1.1 — operação real" />
          </dl>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="card p-4 hover:ring-1 hover:ring-brand-500/40 group flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30 shrink-0">
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{l.label}</p>
                <p className="text-xs text-ink-muted truncate">{l.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-subtle group-hover:text-magenta-400" />
            </Link>
          );
        })}
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
