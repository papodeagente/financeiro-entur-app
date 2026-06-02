import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import type { UserRole } from "@prisma/client";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new Error("Sem permissão para esta ação.");
  }
  return session;
}

const writeRoles: UserRole[] = ["ADMIN", "FINANCEIRO"];
export const requireWrite = () => requireRole(writeRoles);
