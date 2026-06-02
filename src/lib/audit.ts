import { prisma } from "./db";
import type { AuditAction, Prisma } from "@prisma/client";

export async function audit(
  userId: string | null,
  action: AuditAction,
  entity: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  try {
    await tx.auditLog.create({
      data: {
        userId, action, entity, entityId,
        before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
        after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
      },
    });
  } catch {
    // auditoria não pode quebrar a operação principal
  }
}
