"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertBankAccount, toggleBankAccountActive } from "@/lib/actions/bank-accounts";
import { bankAccountTypeLabel } from "@/lib/validations";
import type { ActionResult } from "@/lib/action-result";

export type BankAccountRow = {
  id: string; name: string; type: string;
  bank: string | null; agency: string | null; accountNumber: string | null;
  openingBalance: string; currentBalance: string;
  notes: string | null; active: boolean;
};

function FormDrawer({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: BankAccountRow | null }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertBankAccount, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose}
      title={initial ? "Editar conta" : "Nova conta bancária"}
      description="Conta corrente, gateway, cartão de crédito ou caixa interno."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Nome" required error={fe("name")} className="sm:col-span-2">
            <TextInput name="name" defaultValue={initial?.name ?? ""} required autoFocus placeholder="Ex.: Itaú PJ — Principal" />
          </Field>
          <Field label="Tipo" required error={fe("type")}>
            <Select name="type" defaultValue={initial?.type ?? "CORRENTE"} required>
              {Object.entries(bankAccountTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Banco / Provedor" error={fe("bank")}>
            <TextInput name="bank" defaultValue={initial?.bank ?? ""} placeholder="Ex.: Itaú / Asaas / Stripe" />
          </Field>
          <Field label="Agência" error={fe("agency")}>
            <TextInput name="agency" defaultValue={initial?.agency ?? ""} placeholder="0000" />
          </Field>
          <Field label="Conta" error={fe("accountNumber")}>
            <TextInput name="accountNumber" defaultValue={initial?.accountNumber ?? ""} placeholder="00000-0" />
          </Field>
          <Field
            label={initial ? "Saldo inicial (referência)" : "Saldo inicial"}
            error={fe("openingBalance")}
            hint={initial ? "Não recalcula saldo atual ao editar." : "Será replicado no saldo atual ao criar."}
            className="sm:col-span-2"
          >
            <TextInput name="openingBalance" defaultValue={initial?.openingBalance ?? "0,00"} required placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea name="notes" defaultValue={initial?.notes ?? ""} placeholder="Informações adicionais sobre a conta." />
          </Field>
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} />
      </form>
    </Drawer>
  );
}

export function NewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova conta
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RowActions({ row }: { row: BankAccountRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title={row.active ? "Desativar" : "Reativar"} disabled={pending}
        onClick={() => start(async () => { await toggleBankAccountActive(row.id); })}>
        <Power className="h-3.5 w-3.5" />
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} />
    </div>
  );
}
