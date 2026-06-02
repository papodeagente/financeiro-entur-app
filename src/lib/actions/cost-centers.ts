"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { costCenterSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export async function upsertCostCenter(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(costCenterSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, name } = parsed.data;
  try {
    if (id) await prisma.costCenter.update({ where: { id }, data: { name } });
    else await prisma.costCenter.create({ data: { name } });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") return fail("Já existe centro de custo com esse nome.");
    return fail("Erro ao salvar centro de custo.");
  }
  revalidatePath("/centros-de-custo");
  return ok();
}

export async function toggleCostCenterActive(id: string): Promise<ActionResult> {
  await requireWrite();
  const cc = await prisma.costCenter.findUnique({ where: { id }, select: { active: true } });
  if (!cc) return fail("Centro de custo não encontrado.");
  await prisma.costCenter.update({ where: { id }, data: { active: !cc.active } });
  revalidatePath("/centros-de-custo");
  return ok();
}
