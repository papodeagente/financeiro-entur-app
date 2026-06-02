import Link from "next/link";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PageShell, EmptyState } from "@/components/layout/page-shell";
import { dateTimeBR } from "@/lib/format";
import { syncFinancialAlerts } from "@/lib/notifications";
import { MarkAllReadButton } from "./_components/actions";
import { AlertTriangle, Info, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const kindStyle: Record<string, { icon: React.ReactNode; ring: string }> = {
  INFO: { icon: <Info className="h-4 w-4 text-info" />, ring: "ring-info/30 bg-info/10" },
  ALERTA: { icon: <AlertTriangle className="h-4 w-4 text-warn" />, ring: "ring-warn/30 bg-warn/10" },
  SUCESSO: { icon: <CheckCircle2 className="h-4 w-4 text-ok" />, ring: "ring-ok/30 bg-ok/10" },
  ERRO: { icon: <XCircle className="h-4 w-4 text-danger" />, ring: "ring-danger/30 bg-danger/10" },
};

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  await syncFinancialAlerts();
  const list = await prisma.notification.findMany({
    where: { OR: [{ userId: session.user.id }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = list.filter((n) => !n.readAt).length;

  return (
    <PageShell
      title="Notificações"
      description="Alertas financeiros (inadimplência, contas a vencer, caixa negativo previsto)."
      actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
    >
      {list.length === 0 ? (
        <EmptyState title="Sem notificações" description="Os alertas chegam aqui automaticamente — inadimplência, contas vencendo, caixa negativo previsto." />
      ) : (
        <ul className="space-y-2">
          {list.map((n) => {
            const s = kindStyle[n.kind] ?? kindStyle.INFO;
            const unread = !n.readAt;
            return (
              <li key={n.id} className={"card p-4 flex items-start gap-3 " + (unread ? "ring-1 ring-brand-500/30" : "")}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ${s.ring}`}>{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className={"text-sm " + (unread ? "font-semibold text-ink" : "text-ink-muted")}>{n.title}</h3>
                    <span className="text-[11px] text-ink-subtle whitespace-nowrap">{dateTimeBR(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-1 text-xs text-ink-muted">{n.body.replace(/\s*\[[^\]]+\]\s*$/, "")}</p>}
                  {n.link && (
                    <Link href={n.link} className="mt-2 inline-flex items-center gap-1 text-xs text-magenta-400 hover:text-magenta-500">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
