"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertGoal, deleteGoal } from "@/lib/actions/users";
import type { ActionResult } from "@/lib/action-result";

export type Opt = { id: string; name: string };

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function GoalDrawer({ open, onClose, users, initial, defaultYear }: { open: boolean; onClose: () => void; users: Opt[]; initial?: { id?: string; userId: string; year: number; month: number; targetAmount: string; targetSales: number | null }; defaultYear: number }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertGoal, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;
  const now = new Date();

  return (
    <Drawer open={open} onClose={onClose} title={initial ? "Editar meta" : "Nova meta"}>
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Vendedor" required error={fe("userId")} className="sm:col-span-2">
            <Select name="userId" required defaultValue={initial?.userId ?? ""} disabled={!!initial}>
              <option value="" disabled>—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Mês" required error={fe("month")}>
            <Select name="month" required defaultValue={initial?.month ?? now.getMonth() + 1} disabled={!!initial}>
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Ano" required error={fe("year")}>
            <TextInput type="number" name="year" required defaultValue={initial?.year ?? defaultYear} disabled={!!initial} />
          </Field>
          <Field label="Meta de receita líquida" required error={fe("targetAmount")}>
            <TextInput name="targetAmount" required defaultValue={initial?.targetAmount ?? "0,00"} inputMode="decimal" />
          </Field>
          <Field label="Meta de # vendas (opcional)" error={fe("targetSales")}>
            <TextInput type="number" name="targetSales" defaultValue={initial?.targetSales ?? ""} />
          </Field>
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} />
      </form>
    </Drawer>
  );
}

export function NewGoalButton({ users, year }: { users: Opt[]; year: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova meta
      </button>
      <GoalDrawer open={open} onClose={() => setOpen(false)} users={users} defaultYear={year} />
    </>
  );
}

export function GoalActions({ id, userId, year, month, targetAmount, targetSales, users }: { id: string; userId: string; year: number; month: number; targetAmount: string; targetSales: number | null; users: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title="Excluir meta" disabled={pending}
        onClick={() => { if (confirm("Excluir meta?")) start(async () => { await deleteGoal(id); }); }}>
        <Trash2 className="h-3.5 w-3.5 text-danger" />
      </button>
      <GoalDrawer open={open} onClose={() => setOpen(false)} users={users} defaultYear={year} initial={{ id, userId, year, month, targetAmount, targetSales }} />
    </div>
  );
}
