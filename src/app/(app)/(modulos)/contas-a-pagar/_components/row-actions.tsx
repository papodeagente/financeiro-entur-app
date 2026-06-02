"use client";
import { useActionState, useEffect, useState } from "react";
import { Check, Paperclip } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { markExpensePaid } from "@/lib/actions/expenses";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type ExpenseQuickPay = {
  id: string; description: string; amount: string;
  bankAccountId: string | null; paymentMethodId: string | null;
  attachmentUrl: string | null;
};
export type Opt = { id: string; name: string };

export function PayActions({ row, bankAccounts, paymentMethods }: { row: ExpenseQuickPay; bankAccounts: Opt[]; paymentMethods: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-end gap-1">
      {row.attachmentUrl && (
        <a href={row.attachmentUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5" title="Ver comprovante">
          <Paperclip className="h-3.5 w-3.5" />
        </a>
      )}
      <button className="btn-ghost p-1.5" title="Marcar como pago" onClick={() => setOpen(true)}>
        <Check className="h-3.5 w-3.5 text-ok" />
      </button>
      <PayDrawer open={open} onClose={() => setOpen(false)} row={row} bankAccounts={bankAccounts} paymentMethods={paymentMethods} />
    </div>
  );
}

function PayDrawer({ open, onClose, row, bankAccounts, paymentMethods }: { open: boolean; onClose: () => void; row: ExpenseQuickPay; bankAccounts: Opt[]; paymentMethods: Opt[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(markExpensePaid, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} title="Registrar pagamento" description={`${row.description} — ${Number(row.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}>
      <form action={formAction} key={snapshot} className="space-y-4">
        <input type="hidden" name="expenseId" defaultValue={row.id} />
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Data do pagamento" required error={fe("paidAt")}>
            <TextInput type="date" name="paidAt" required defaultValue={todayISODate()} />
          </Field>
          <Field label="Conta bancária" error={fe("bankAccountId")} hint="Será debitada com este valor">
            <Select name="bankAccountId" defaultValue={row.bankAccountId ?? ""}>
              <option value="">— sem conta —</option>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Método" error={fe("paymentMethodId")}>
            <Select name="paymentMethodId" defaultValue={row.paymentMethodId ?? ""}>
              <option value="">—</option>
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="URL do comprovante (opcional)" error={fe("attachmentUrl")}>
            <TextInput name="attachmentUrl" defaultValue={row.attachmentUrl ?? ""} placeholder="https://…" />
          </Field>
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel="Confirmar pagamento" />
      </form>
    </Drawer>
  );
}
