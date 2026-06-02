"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { productSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export async function upsertProduct(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(productSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, ...data } = parsed.data;
  try {
    if (id) await prisma.product.update({ where: { id }, data });
    else await prisma.product.create({ data });
  } catch {
    return fail("Erro ao salvar produto.");
  }
  revalidatePath("/produtos");
  return ok();
}

export async function toggleProductActive(id: string): Promise<ActionResult> {
  await requireWrite();
  const p = await prisma.product.findUnique({ where: { id }, select: { active: true } });
  if (!p) return fail("Produto não encontrado.");
  await prisma.product.update({ where: { id }, data: { active: !p.active } });
  revalidatePath("/produtos");
  return ok();
}
