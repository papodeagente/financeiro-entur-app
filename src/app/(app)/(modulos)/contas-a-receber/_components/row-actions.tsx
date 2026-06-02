"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Calendar, MessageSquare, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { markInstallmentPaid, changeInstallmentDueDate, cancelInstallment, setInstallmentNegotiating } from "@/lib/actions/installments";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type InstallmentRowAction = {
  id: string;
  amount: string;
  paidAmount: string;
  number: number;
  totalInstallments: number;
  bankAccountId: string | null;
  paymentMethodId: string | null;
  dueDate: string; // ISO
  customerName: string;
};

export type Opt = { id: string; name: string };

export function RowActions({
  row, bankAccounts, paymentMethods,
}: { row: InstallmentRowAction; bankAccounts: Opt[]; paymentMethods: Opt[] }) {
  const [openPay, setOpenPay] = useState(false);
  const [openDue, setOpenDue] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" title="Marcar como pago" onClick={() => setOpenPay(true)}>
        <Check className="h-3.5 w-3.5 text-ok" />
      </button>
      <button className="btn-ghost p-1.5" title="Alterar vencimento" onClick={() => setOpenDue(true)}>
        <Calendar className="h-3.5 w-3.5" />
      </button>
      <button className="btn-ghost p-1.5" title="Marcar em negociação" disabled={pending}
        onClick={() => start(async () => { await setInstallmentNegotiating(row.id); })}>
        <MessageSquare className="h-3.5 w-3.5 text-warn" />
      </button>
      <button className="btn-ghost p-1.5" title="Cancelar parcela" disabled={pending}
        onClick={() => {
          if (confirm(`Cancelar parcela ${row.number}/${row.totalInstallments} de ${row.customerName}?`)) {
            start(async () => { await cancelInstallment(row.id); });
          }
        }}>
        <X className="h-3.5 w-3.5 text-danger" />
      </button>
      <MarkPaidDrawer open={openPay} onClose={() => setOpenPay(false)} row={row} bankAccounts={bankAccounts} paymentMethods={paymentMethods} />
      <ChangeDueDateDrawer open={openDue} onClose={() => setOpenDue(false)} row={row} />
    </div>
  );
}

function MarkPaidDrawer({
  open, onClose, row, bankAccounts, paymentMethods,
}: { open: boolean; onClose: () => void; row: InstallmentRowAction; bankAccounts: Opt[]; paymentMethods: Opt[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(markInstallmentPaid, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  const remaining = +((+row.amount) - (+row.paidAmount)).toFixed(2);
  const remainingBRL = remaining.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Drawer open={open} onClose={onClose}
      title={`Registrar pagamento — parcela ${row.number}/${row.totalInstallments}`}
      description={`${row.customerName} · Falta receber: ${remainingBRL}`}
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        <input type="hidden" name="installmentId" defaultValue={row.id} />
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Data do pagamento" required error={fe("paidAt")}>
            <TextInput type="date" name="paidAt" required defaultValue={todayISODate()} />
          </Field>
          <Field label="Valor recebido" required error={fe("paidAmount")} hint={remaining < (+row.amount) ? `Parcial possível. Restante: ${remainingBRL}` : undefined}>
            <TextInput name="paidAmount" required defaultValue={remaining.toFixed(2).replace(".", ",")} inputMode="decimal" />
          </Field>
          <Field label="Conta bancária" error={fe("bankAccountId")} hint="Será creditada com este valor.">
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
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel="Confirmar recebimento" />
      </form>
    </Drawer>
  );
}

function ChangeDueDateDrawer({
  open, onClose, row,
}: { open: boolean; onClose: () => void; row: InstallmentRowAction }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(changeInstallmentDueDate, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} title="Alterar vencimento">
      <form action={formAction} key={snapshot} className="space-y-4">
        <input type="hidden" name="installmentId" defaultValue={row.id} />
        <FormError message={!state?.ok ? state?.error : undefined} />
        <Field label="Vencimento atual">
          <TextInput value={row.dueDate.slice(0, 10).split("-").reverse().join("/")} disabled />
        </Field>
        <Field label="Novo vencimento" required error={fe("newDueDate")}>
          <TextInput type="date" name="newDueDate" required defaultValue={row.dueDate.slice(0, 10)} />
        </Field>
        <Field label="Motivo (opcional)">
          <TextInput name="reason" placeholder="Promessa de pagamento, renegociação…" />
        </Field>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel="Salvar novo vencimento" />
      </form>
    </Drawer>
  );
}
