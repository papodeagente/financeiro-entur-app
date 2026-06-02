"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, X, Copy } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertExpense, cancelExpense, duplicateExpense } from "@/lib/actions/expenses";
import { expenseRecurrenceLabel } from "@/lib/validations";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type Opt = { id: string; name: string };
export type ExpenseRow = {
  id: string; description: string;
  supplierId: string | null; categoryId: string | null;
  costCenterId: string | null; bankAccountId: string | null;
  paymentMethodId: string | null; responsibleId: string | null;
  amount: string; dueDate: string; competenceDate: string;
  recurrence: string; status: string;
  attachmentUrl: string | null; notes: string | null;
};

function FormDrawer({
  open, onClose, initial, suppliers, categories, costCenters, bankAccounts, paymentMethods, users,
}: {
  open: boolean; onClose: () => void; initial?: ExpenseRow | null;
  suppliers: Opt[]; categories: Opt[]; costCenters: Opt[];
  bankAccounts: Opt[]; paymentMethods: Opt[]; users: Opt[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertExpense, null);
  const [snapshot, setSnapshot] = useState(0);
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? "NENHUMA");
  useEffect(() => {
    if (open) { setSnapshot((s) => s + 1); setRecurrence(initial?.recurrence ?? "NENHUMA"); }
  }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-3xl"
      title={initial ? "Editar despesa" : "Nova despesa"}
      description="Despesas únicas ou recorrentes (mensal/trimestral/semestral/anual)."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Descrição" required error={fe("description")} className="sm:col-span-2">
            <TextInput name="description" defaultValue={initial?.description ?? ""} required autoFocus placeholder="Ex.: Mensalidade Google Workspace" />
          </Field>
          <Field label="Fornecedor" error={fe("supplierId")}>
            <Select name="supplierId" defaultValue={initial?.supplierId ?? ""}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Categoria" error={fe("categoryId")}>
            <Select name="categoryId" defaultValue={initial?.categoryId ?? ""}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Centro de custo" error={fe("costCenterId")}>
            <Select name="costCenterId" defaultValue={initial?.costCenterId ?? ""}>
              <option value="">—</option>
              {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Responsável" error={fe("responsibleId")}>
            <Select name="responsibleId" defaultValue={initial?.responsibleId ?? ""}>
              <option value="">—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Valor" required error={fe("amount")}>
            <TextInput name="amount" required defaultValue={initial?.amount ?? "0,00"} inputMode="decimal" />
          </Field>
          <Field label="Vencimento" required error={fe("dueDate")}>
            <TextInput type="date" name="dueDate" required defaultValue={initial?.dueDate?.slice(0, 10) ?? todayISODate()} />
          </Field>
          <Field label="Data de competência" required error={fe("competenceDate")} hint="Mês ao qual a despesa pertence (DRE)">
            <TextInput type="date" name="competenceDate" required defaultValue={initial?.competenceDate?.slice(0, 10) ?? todayISODate()} />
          </Field>
          <Field label="Recorrência" required error={fe("recurrence")}>
            <Select name="recurrence" required value={recurrence} onChange={(e) => setRecurrence(e.target.value)} disabled={!!initial}>
              {Object.entries(expenseRecurrenceLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          {!initial && recurrence !== "NENHUMA" && (
            <Field label="Nº de ocorrências" error={fe("recurrenceMonths")} hint="Gera essas N despesas futuras agendadas">
              <TextInput type="number" name="recurrenceMonths" defaultValue="12" min={1} max={60} />
            </Field>
          )}
          <Field label="Conta bancária" error={fe("bankAccountId")} hint="Conta a debitar ao pagar">
            <Select name="bankAccountId" defaultValue={initial?.bankAccountId ?? ""}>
              <option value="">—</option>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Método" error={fe("paymentMethodId")}>
            <Select name="paymentMethodId" defaultValue={initial?.paymentMethodId ?? ""}>
              <option value="">—</option>
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="URL do comprovante" error={fe("attachmentUrl")} className="sm:col-span-2">
            <TextInput name="attachmentUrl" defaultValue={initial?.attachmentUrl ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea name="notes" defaultValue={initial?.notes ?? ""} />
          </Field>
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel={initial ? "Salvar alterações" : recurrence === "NENHUMA" ? "Criar despesa" : "Criar despesa + recorrência"} />
      </form>
    </Drawer>
  );
}

export function NewButton(props: { suppliers: Opt[]; categories: Opt[]; costCenters: Opt[]; bankAccounts: Opt[]; paymentMethods: Opt[]; users: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova despesa
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

export function RowActions({ row, suppliers, categories, costCenters, bankAccounts, paymentMethods, users }: {
  row: ExpenseRow; suppliers: Opt[]; categories: Opt[]; costCenters: Opt[];
  bankAccounts: Opt[]; paymentMethods: Opt[]; users: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const canCancel = row.status !== "CANCELADO";
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" title="Editar" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title="Duplicar (próximo mês)" disabled={pending}
        onClick={() => start(async () => { await duplicateExpense(row.id); })}>
        <Copy className="h-3.5 w-3.5" />
      </button>
      {canCancel && (
        <button className="btn-ghost p-1.5" title="Cancelar despesa" disabled={pending}
          onClick={() => { if (confirm(`Cancelar despesa "${row.description}"?`)) start(async () => { await cancelExpense(row.id); }); }}>
          <X className="h-3.5 w-3.5 text-danger" />
        </button>
      )}
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} suppliers={suppliers} categories={categories} costCenters={costCenters} bankAccounts={bankAccounts} paymentMethods={paymentMethods} users={users} />
    </div>
  );
}
