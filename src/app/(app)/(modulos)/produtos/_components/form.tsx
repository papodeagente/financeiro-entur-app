"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertProduct, toggleProductActive } from "@/lib/actions/products";
import { productTypeLabel, productBillingLabel } from "@/lib/validations";
import type { ActionResult } from "@/lib/action-result";

export type ProductRow = {
  id: string; name: string; description: string | null;
  type: string; billing: string;
  defaultPrice: string;
  estimatedCost: string | null; estimatedMargin: string | null;
  defaultCommissionPercent: string | null;
  accessDurationDays: number | null;
  categoryId: string | null; costCenterId: string | null;
  active: boolean; notes: string | null;
};
export type Option = { id: string; name: string };

function FormDrawer({
  open, onClose, initial, categories, costCenters,
}: { open: boolean; onClose: () => void; initial?: ProductRow | null; categories: Option[]; costCenters: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertProduct, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-2xl"
      title={initial ? "Editar produto" : "Novo produto"}
      description="Cursos, mentorias, comunidades, eventos, consultorias e mais."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Nome" required error={fe("name")} className="sm:col-span-2">
            <TextInput name="name" defaultValue={initial?.name ?? ""} required autoFocus placeholder="Ex.: Mentoria Trekker" />
          </Field>
          <Field label="Tipo" required error={fe("type")}>
            <Select name="type" defaultValue={initial?.type ?? "CURSO"} required>
              {Object.entries(productTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Cobrança" required error={fe("billing")}>
            <Select name="billing" defaultValue={initial?.billing ?? "UNICA"} required>
              {Object.entries(productBillingLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Preço padrão" required error={fe("defaultPrice")}>
            <TextInput name="defaultPrice" defaultValue={initial?.defaultPrice ?? "0,00"} required placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Comissão padrão (%)" error={fe("defaultCommissionPercent")} hint="Pode ser sobreposta na venda">
            <TextInput name="defaultCommissionPercent" defaultValue={initial?.defaultCommissionPercent ?? ""} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Custo operacional estimado" error={fe("estimatedCost")}>
            <TextInput name="estimatedCost" defaultValue={initial?.estimatedCost ?? ""} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Margem estimada (%)" error={fe("estimatedMargin")}>
            <TextInput name="estimatedMargin" defaultValue={initial?.estimatedMargin ?? ""} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Categoria" error={fe("categoryId")}>
            <Select name="categoryId" defaultValue={initial?.categoryId ?? ""}>
              <option value="">— sem categoria —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Centro de custo" error={fe("costCenterId")}>
            <Select name="costCenterId" defaultValue={initial?.costCenterId ?? ""}>
              <option value="">— sem centro —</option>
              {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Validade de acesso (dias)" error={fe("accessDurationDays")} hint="Vazio = vitalício">
            <TextInput type="number" name="accessDurationDays" defaultValue={initial?.accessDurationDays ?? ""} placeholder="365" />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <TextArea name="description" defaultValue={initial?.description ?? ""} />
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

export function NewButton({ categories, costCenters }: { categories: Option[]; costCenters: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo produto
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} categories={categories} costCenters={costCenters} />
    </>
  );
}

export function RowActions({ row, categories, costCenters }: { row: ProductRow; categories: Option[]; costCenters: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title={row.active ? "Desativar" : "Reativar"} disabled={pending}
        onClick={() => start(async () => { await toggleProductActive(row.id); })}>
        <Power className="h-3.5 w-3.5" />
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} categories={categories} costCenters={costCenters} />
    </div>
  );
}
