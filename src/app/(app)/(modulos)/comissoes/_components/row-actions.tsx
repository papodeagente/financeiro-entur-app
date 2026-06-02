"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Lock, Unlock, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid, TextArea } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { payCommission, blockCommission, releaseCommission, cancelCommission } from "@/lib/actions/commissions";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type CommissionQuick = {
  id: string; payeeName: string; amount: string; status: string;
};
export type Opt = { id: string; name: string };

export function CommissionActions({ row, bankAccounts }: { row: CommissionQuick; bankAccounts: Opt[] }) {
  const [openPay, setOpenPay] = useState(false);
  const [pending, start] = useTransition();
  const canPay = row.status === "LIBERADA" || row.status === "PENDENTE";
  const isBlocked = row.status === "BLOQUEADA";
  const canCancel = !["PAGA", "ESTORNADA", "CANCELADA"].includes(row.status);

  return (
    <div className="flex items-center justify-end gap-1">
      {canPay && (
        <button className="btn-ghost p-1.5" title="Pagar comissão" onClick={() => setOpenPay(true)}>
          <Check className="h-3.5 w-3.5 text-ok" />
        </button>
      )}
      {row.status === "LIBERADA" && (
        <button className="btn-ghost p-1.5" title="Bloquear" disabled={pending}
          onClick={() => start(async () => { await blockCommission(row.id); })}>
          <Lock className="h-3.5 w-3.5 text-warn" />
        </button>
      )}
      {isBlocked && (
        <button className="btn-ghost p-1.5" title="Liberar" disabled={pending}
          onClick={() => start(async () => { await releaseCommission(row.id); })}>
          <Unlock className="h-3.5 w-3.5 text-ok" />
        </button>
      )}
      {canCancel && (
        <button className="btn-ghost p-1.5" title="Cancelar" disabled={pending}
          onClick={() => { if (confirm(`Cancelar comissão de ${row.payeeName}?`)) start(async () => { await cancelCommission(row.id); }); }}>
          <X className="h-3.5 w-3.5 text-danger" />
        </button>
      )}
      <PayDrawer open={openPay} onClose={() => setOpenPay(false)} row={row} bankAccounts={bankAccounts} />
    </div>
  );
}

function PayDrawer({ open, onClose, row, bankAccounts }: { open: boolean; onClose: () => void; row: CommissionQuick; bankAccounts: Opt[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(payCommission, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} title="Pagar comissão" description={`${row.payeeName} — ${Number(row.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}>
      <form action={formAction} key={snapshot} className="space-y-4">
        <input type="hidden" name="commissionId" defaultValue={row.id} />
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Data do pagamento" required error={fe("paidAt")}>
            <TextInput type="date" name="paidAt" required defaultValue={todayISODate()} />
          </Field>
          <Field label="Conta bancária" error={fe("bankAccountId")} hint="Será debitada">
            <Select name="bankAccountId" defaultValue="">
              <option value="">— sem conta —</option>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea name="notes" placeholder="Comprovante, lote de pagamento, etc." />
          </Field>
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel="Confirmar pagamento" />
      </form>
    </Drawer>
  );
}
