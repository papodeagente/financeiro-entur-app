"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { customerSchema } from "@/lib/validations";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export async function upsertCustomer(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireWrite();
  const parsed = safeParseForm(customerSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { id, ...data } = parsed.data;
  try {
    if (id) await prisma.customer.update({ where: { id }, data });
    else await prisma.customer.create({ data });
  } catch {
    return fail("Erro ao salvar cliente.");
  }
  revalidatePath("/clientes");
  return ok();
}

export async function softDeleteCustomer(id: string): Promise<ActionResult> {
  await requireWrite();
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/clientes");
  return ok();
}
