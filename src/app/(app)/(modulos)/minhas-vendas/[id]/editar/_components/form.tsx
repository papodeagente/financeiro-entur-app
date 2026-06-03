"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-actions";
import { editPendingSale } from "@/lib/actions/sales";
import type { ActionResult } from "@/lib/action-result";

type Sale = {
  id: string; productId: string; paymentMethodId: string | null;
  grossAmount: string; feeAmount: string; installmentsCount: number;
  cohort: string | null; campaign: string | null;
  crmLink: string | null; receiptUrl: string | null; contractUrl: string | null; notes: string | null;
  validationStatus: string;
};

export function EditSaleForm({ sale, products, paymentMethods }: { sale: Sale; products: { id: string; name: string }[]; paymentMethods: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(editPendingSale, null);
  useEffect(() => { if (state?.ok) router.push("/minhas-vendas?updated=1"); }, [state, router]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  const grossFmt = Number(sale.grossAmount).toFixed(2).replace(".", ",");
  const feeFmt = Number(sale.feeAmount).toFixed(2).replace(".", ",");

  return (
    <form action={formAction} className="card p-6 space-y-4">
      <input type="hidden" name="saleId" defaultValue={sale.id} />
      {state && !state.ok && <FormError message={state.error} />}
      <FormGrid cols={2}>
        <Field label="Produto" required error={fe("productId")} className="sm:col-span-2">
          <Select name="productId" required defaultValue={sale.productId}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Valor bruto" required error={fe("grossAmount")}>
          <TextInput name="grossAmount" required defaultValue={grossFmt} inputMode="decimal" />
        </Field>
        <Field label="Taxas" error={fe("feeAmount")}>
          <TextInput name="feeAmount" defaultValue={feeFmt} inputMode="decimal" />
        </Field>
        <Field label="Parcelas" required error={fe("installmentsCount")}>
          <TextInput type="number" name="installmentsCount" required min={1} max={48} defaultValue={sale.installmentsCount} />
        </Field>
        <Field label="Forma de pagamento" error={fe("paymentMethodId")}>
          <Select name="paymentMethodId" defaultValue={sale.paymentMethodId ?? ""}>
            <option value="">—</option>
            {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Turma / Cohort">
          <TextInput name="cohort" defaultValue={sale.cohort ?? ""} />
        </Field>
        <Field label="Campanha">
          <TextInput name="campaign" defaultValue={sale.campaign ?? ""} />
        </Field>
        <Field label="Link contrato" className="sm:col-span-2">
          <TextInput name="contractUrl" defaultValue={sale.contractUrl ?? ""} />
        </Field>
        <Field label="Link comprovante" className="sm:col-span-2">
          <TextInput name="receiptUrl" defaultValue={sale.receiptUrl ?? ""} />
        </Field>
        <Field label="Link CRM" className="sm:col-span-2">
          <TextInput name="crmLink" defaultValue={sale.crmLink ?? ""} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <TextArea name="notes" defaultValue={sale.notes ?? ""} />
        </Field>
      </FormGrid>
      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : sale.validationStatus === "NEEDS_ADJUSTMENT" ? "Salvar e reenviar pra validação" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
