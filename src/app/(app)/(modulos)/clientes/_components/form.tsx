"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertCustomer, softDeleteCustomer } from "@/lib/actions/customers";
import { customerStatusLabel, saleOriginLabel } from "@/lib/validations";
import type { ActionResult } from "@/lib/action-result";

export type CustomerRow = {
  id: string; name: string; email: string | null; phone: string | null;
  document: string | null; company: string | null;
  addressLine: string | null; city: string | null; state: string | null; zip: string | null;
  status: string; origin: string | null; notes: string | null;
};

function FormDrawer({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: CustomerRow | null }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertCustomer, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-2xl"
      title={initial ? "Editar cliente" : "Novo cliente / aluno"}
      description="Cadastro financeiro do aluno, contato e histórico de compras."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Nome completo" required error={fe("name")} className="sm:col-span-2">
            <TextInput name="name" defaultValue={initial?.name ?? ""} required autoFocus />
          </Field>
          <Field label="Email" error={fe("email")}>
            <TextInput type="email" name="email" defaultValue={initial?.email ?? ""} />
          </Field>
          <Field label="Telefone" error={fe("phone")}>
            <TextInput name="phone" defaultValue={initial?.phone ?? ""} placeholder="+55 (11) 90000-0000" />
          </Field>
          <Field label="CPF / CNPJ" error={fe("document")}>
            <TextInput name="document" defaultValue={initial?.document ?? ""} />
          </Field>
          <Field label="Empresa" error={fe("company")}>
            <TextInput name="company" defaultValue={initial?.company ?? ""} />
          </Field>
          <Field label="Status financeiro" required error={fe("status")}>
            <Select name="status" defaultValue={initial?.status ?? "ATIVO"} required>
              {Object.entries(customerStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Origem da relação" error={fe("origin")}>
            <Select name="origin" defaultValue={initial?.origin ?? ""}>
              <option value="">—</option>
              {Object.entries(saleOriginLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            <TextInput name="addressLine" defaultValue={initial?.addressLine ?? ""} />
          </Field>
          <Field label="Cidade"><TextInput name="city" defaultValue={initial?.city ?? ""} /></Field>
          <Field label="UF"><TextInput name="state" defaultValue={initial?.state ?? ""} maxLength={2} /></Field>
          <Field label="CEP" className="sm:col-span-2"><TextInput name="zip" defaultValue={initial?.zip ?? ""} /></Field>
          <Field label="Observações" className="sm:col-span-2"><TextArea name="notes" defaultValue={initial?.notes ?? ""} /></Field>
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
        <Plus className="h-4 w-4" /> Novo cliente
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RowActions({ row }: { row: CustomerRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title="Inativar (soft delete)" disabled={pending}
        onClick={() => {
          if (confirm(`Inativar cliente "${row.name}"? Pode ser restaurado depois pelo banco.`)) {
            start(async () => { await softDeleteCustomer(row.id); });
          }
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} />
    </div>
  );
}
