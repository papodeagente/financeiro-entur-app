"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { categorySchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export async function upsertCategory(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(categorySchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, name, kind } = parsed.data;
  try {
    if (id) await prisma.financialCategory.update({ where: { id }, data: { name, kind } });
    else await prisma.financialCategory.create({ data: { name, kind } });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return fail("Já existe categoria com esse nome neste tipo.");
    return fail("Erro ao salvar categoria.");
  }
  revalidatePath("/categorias");
  return ok();
}

export async function toggleCategoryActive(id: string): Promise<ActionResult> {
  await requireWrite();
  const cat = await prisma.financialCategory.findUnique({ where: { id }, select: { active: true } });
  if (!cat) return fail("Categoria não encontrada.");
  await prisma.financialCategory.update({ where: { id }, data: { active: !cat.active } });
  revalidatePath("/categorias");
  return ok();
}
