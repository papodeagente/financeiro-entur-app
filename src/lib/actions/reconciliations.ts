"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeParseForm } from "@/lib/action-result";

const numFromBRL = (s: string) => Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0;

const reconcileSchema = z.object({
  installmentId: z.string().min(1),
  platformFee: z.string().transform((s) => numFromBRL(s)),
  gatewayFee: z.string().transform((s) => numFromBRL(s)),
  netAmount: z.string().transform((s) => numFromBRL(s)),
  receivedAt: z.string().min(1).transform((s) => new Date(s)),
  bankAccountId: z.string().optional().transform((s) => (s && s.trim() !== "" ? s : undefined)),
  notes: z.string().optional().transform((s) => (s && s.trim() !== "" ? s : undefined)),
});

export async function upsertReconciliation(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(reconcileSchema, formData);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  const inst = await prisma.revenueInstallment.findUnique({ where: { id: d.installmentId } });
  if (!inst) return fail("Parcela não encontrada.");
  const gross = Number(inst.amount);
  const expectedNet = gross - d.platformFee - d.gatewayFee;
  const diff = Math.abs(expectedNet - d.netAmount);
  const status = diff < 0.01 ? "CONCILIADO" : "DIVERGENTE";

  await prisma.reconciliation.upsert({
    where: { installmentId: d.installmentId },
    create: {
      installmentId: d.installmentId, bankAccountId: d.bankAccountId,
      grossAmount: gross, platformFee: d.platformFee, gatewayFee: d.gatewayFee,
      netAmount: d.netAmount, receivedAt: d.receivedAt, status, notes: d.notes,
    },
    update: {
      bankAccountId: d.bankAccountId, platformFee: d.platformFee, gatewayFee: d.gatewayFee,
      netAmount: d.netAmount, receivedAt: d.receivedAt, status, notes: d.notes,
    },
  });

  revalidatePath("/conciliacao");
  return ok();
}
