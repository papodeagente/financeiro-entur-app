"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertSupplier, toggleSupplierActive } from "@/lib/actions/suppliers";
import type { ActionResult } from "@/lib/action-result";

export type SupplierRow = {
  id: string; name: string; document: string | null; email: string | null;
  phone: string | null; category: string | null; bankInfo: string | null;
  addressLine: string | null; notes: string | null; active: boolean;
};

function FormDrawer({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: SupplierRow | null }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertSupplier, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} title={initial ? "Editar fornecedor" : "Novo fornecedor"}>
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Nome / Razão social" required error={fe("name")} className="sm:col-span-2">
            <TextInput name="name" defaultValue={initial?.name ?? ""} required autoFocus />
          </Field>
          <Field label="CPF / CNPJ" error={fe("document")}>
            <TextInput name="document" defaultValue={initial?.document ?? ""} />
          </Field>
          <Field label="Categoria" error={fe("category")} hint="Ex: Ferramentas, Tráfego pago, Plataformas">
            <TextInput name="category" defaultValue={initial?.category ?? ""} placeholder="Categoria livre" />
          </Field>
          <Field label="Email" error={fe("email")}>
            <TextInput type="email" name="email" defaultValue={initial?.email ?? ""} />
          </Field>
          <Field label="Telefone" error={fe("phone")}>
            <TextInput name="phone" defaultValue={initial?.phone ?? ""} />
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            <TextInput name="addressLine" defaultValue={initial?.addressLine ?? ""} />
          </Field>
          <Field label="Dados bancários" className="sm:col-span-2" hint="Pix, conta, ou observações de pagamento">
            <TextArea name="bankInfo" defaultValue={initial?.bankInfo ?? ""} />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea name="notes" defaultValue={initial?.notes ?? ""} />
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
        <Plus className="h-4 w-4" /> Novo fornecedor
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RowActions({ row }: { row: SupplierRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title={row.active ? "Desativar" : "Reativar"} disabled={pending}
        onClick={() => start(async () => { await toggleSupplierActive(row.id); })}>
        <Power className="h-3.5 w-3.5" />
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} />
    </div>
  );
}
