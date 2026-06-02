import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { dateTimeBR } from "@/lib/format";
import { InviteButton, UserActions, InvitationRow } from "./_components/actions";

export const dynamic = "force-dynamic";

const roleBadge: Record<string, string> = {
  ADMIN: "badge-info", FINANCEIRO: "badge-ok", COMERCIAL: "badge-warn",
  GESTOR: "badge-info", CONSULTOR: "badge-muted", READONLY: "badge-muted",
};

export default async function Page() {
  await requireRole(["ADMIN"]);

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  type Row = (typeof users)[number];
  const userColumns: Column<Row>[] = [
    { header: "Nome", cell: (u) => <span className={u.active ? "text-ink font-medium" : "text-ink-subtle line-through"}>{u.name}</span> },
    { header: "Email", cell: (u) => <span className="text-ink-muted text-xs">{u.email}</span> },
    { header: "Perfil", cell: (u) => <span className={roleBadge[u.role] ?? "badge-muted"}>{u.role}</span>, width: "140px" },
    { header: "Status", cell: (u) => u.active ? <span className="badge-ok">Ativo</span> : <span className="badge-muted">Inativo</span>, width: "100px" },
    { header: "Último acesso", cell: (u) => <span className="text-xs text-ink-muted">{dateTimeBR(u.lastLoginAt)}</span>, width: "180px" },
    { header: "", cell: (u) => <UserActions id={u.id} active={u.active} />, className: "text-right", width: "100px" },
  ];

  return (
    <PageShell
      title="Usuários do sistema"
      description="Gestão de quem acessa o financeiro ENTUR."
      actions={<InviteButton />}
    >
      <DataTable rows={users as Row[]} columns={userColumns} emptyTitle="Nenhum usuário cadastrado" />

      {invitations.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-ink-subtle mb-2 mt-4">Convites pendentes</h3>
          <div className="space-y-2">
            {invitations.map((i) => <InvitationRow key={i.id} id={i.id} email={i.email} name={i.name} role={i.role} token={i.token} expiresAt={i.expiresAt.toISOString()} />)}
          </div>
        </section>
      )}
    </PageShell>
  );
}
