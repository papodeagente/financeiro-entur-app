"use client";
import { useActionState, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertCategory } from "@/lib/actions/categories";
import type { ActionResult } from "@/lib/action-result";

export type CategoryRow = { id: string; name: string; kind: "RECEITA" | "DESPESA" };

export function CategoryFormDrawer({
  open, onClose, initial,
}: { open: boolean; onClose: () => void; initial?: CategoryRow | null }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertCategory, null);
  const [snapshot, setSnapshot] = useState(0);

  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);

  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <Drawer
      open={open} onClose={onClose}
      title={initial ? "Editar categoria" : "Nova categoria"}
      description="Categorias agrupam receitas e despesas e formam a base da DRE."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <Field label="Tipo" required error={fe("kind")}>
          <Select name="kind" defaultValue={initial?.kind ?? "RECEITA"} required>
            <option value="RECEITA">Receita</option>
            <option value="DESPESA">Despesa</option>
          </Select>
        </Field>
        <Field label="Nome" required error={fe("name")}>
          <TextInput name="name" defaultValue={initial?.name ?? ""} required autoFocus placeholder="Ex.: Cursos online" />
        </Field>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel={initial ? "Salvar alterações" : "Criar categoria"} />
      </form>
    </Drawer>
  );
}
