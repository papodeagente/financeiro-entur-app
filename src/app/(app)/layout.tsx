import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { syncFinancialAlerts } from "@/lib/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Sincroniza alertas financeiros (idempotente por dia)
  await syncFinancialAlerts();
  const unread = await prisma.notification.count({
    where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header unreadCount={unread} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
