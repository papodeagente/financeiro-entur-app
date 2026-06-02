import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { dateTimeBR } from "@/lib/format";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const actionLabel: Record<string, string> = {
  CRIAR: "Criou", EDITAR: "Editou", EXCLUIR: "Excluiu",
  MARCAR_PAGO: "Marcou como pago", MARCAR_VENCIDO: "Marcou vencido",
  CANCELAR: "Cancelou", REEMBOLSAR: "Reembolsou", CHARGEBACK: "Chargeback",
  ALTERAR_VENCIMENTO: "Alterou vencimento",
  LIBERAR_COMISSAO: "Liberou comissão", PAGAR_COMISSAO: "Pagou comissão",
  LOGIN: "Entrou", LOGOUT: "Saiu",
};

export default async function Page() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  type Row = (typeof logs)[number];
  const columns: Column<Row>[] = [
    { header: "Data/hora", cell: (r) => <span className="text-xs text-ink-muted">{dateTimeBR(r.createdAt)}</span>, width: "160px" },
    { header: "Usuário", cell: (r) => <span className="text-ink">{r.user?.name ?? "Sistema"}</span>, width: "200px" },
    { header: "Ação", cell: (r) => <span className="badge-muted">{actionLabel[r.action] ?? r.action}</span>, width: "180px" },
    { header: "Entidade", cell: (r) => <span className="text-ink-muted">{r.entity}</span>, width: "140px" },
    { header: "Registro", cell: (r) => <code className="text-[10px] text-ink-subtle">{r.entityId.slice(0, 12)}</code>, width: "140px" },
  ];

  return (
    <PageShell
      title="Log de auditoria"
      description="Últimas 200 alterações financeiras registradas no sistema."
    >
      <Link href="/configuracoes" className="btn-ghost text-sm">
        <ArrowLeft className="h-4 w-4" /> Configurações
      </Link>
      <DataTable rows={logs as Row[]} columns={columns} emptyTitle="Nenhuma alteração auditada ainda" />
    </PageShell>
  );
}
