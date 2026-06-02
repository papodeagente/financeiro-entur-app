"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { supplierSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export async function upsertSupplier(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(supplierSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, ...data } = parsed.data;
  try {
    if (id) await prisma.supplier.update({ where: { id }, data });
    else await prisma.supplier.create({ data });
  } catch {
    return fail("Erro ao salvar fornecedor.");
  }
  revalidatePath("/fornecedores");
  return ok();
}

export async function toggleSupplierActive(id: string): Promise<ActionResult> {
  await requireWrite();
  const s = await prisma.supplier.findUnique({ where: { id }, select: { active: true } });
  if (!s) return fail("Fornecedor não encontrado.");
  await prisma.supplier.update({ where: { id }, data: { active: !s.active } });
  revalidatePath("/fornecedores");
  return ok();
}
