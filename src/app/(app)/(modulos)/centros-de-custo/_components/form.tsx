"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertCostCenter, toggleCostCenterActive } from "@/lib/actions/cost-centers";
import type { ActionResult } from "@/lib/action-result";

export type CostCenterRow = { id: string; name: string; active: boolean };

function FormDrawer({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: CostCenterRow | null }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertCostCenter, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} title={initial ? "Editar centro de custo" : "Novo centro de custo"}>
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <Field label="Nome" required error={fe("name")}>
          <TextInput name="name" defaultValue={initial?.name ?? ""} required autoFocus placeholder="Ex.: Marketing" />
        </Field>
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
        <Plus className="h-4 w-4" /> Novo centro de custo
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RowActions({ row }: { row: CostCenterRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title={row.active ? "Desativar" : "Reativar"} disabled={pending}
        onClick={() => start(async () => { await toggleCostCenterActive(row.id); })}>
        <Power className="h-3.5 w-3.5" />
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} />
    </div>
  );
}
