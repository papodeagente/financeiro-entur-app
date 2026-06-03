"use server";
import { requireSession } from "@/lib/session";
import { analyzeSale, type SaleWarning, type SaleAnalysisInput } from "@/lib/sale-analysis";
import { ok, type ActionResult } from "@/lib/action-result";

export async function analyzeSaleAction(input: {
  customerId?: string;
  customerEmail?: string;
  customerDocument?: string;
  productId: string;
  netAmount: number;
  saleDate?: Date | string;
  receiptUrl?: string;
  contractUrl?: string;
}): Promise<ActionResult<SaleWarning[]>> {
  await requireSession();
  const analysisInput: SaleAnalysisInput = {
    ...input,
    saleDate: input.saleDate ? new Date(input.saleDate) : new Date(),
  };
  const warnings = await analyzeSale(analysisInput);
  return ok(warnings);
}
