"use server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { id, OR: [{ userId: session.user.id }, { userId: null }] },
    data: { readAt: new Date() },
  });
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function markAllRead() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notificacoes");
  return { ok: true };
}
