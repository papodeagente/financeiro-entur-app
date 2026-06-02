"use client";
import { useActionState } from "react";
import { Field, TextInput, FormGrid } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-actions";
import { changePassword } from "@/lib/actions/users";
import { CheckCircle2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(changePassword, null);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} key={state?.ok ? "ok" : "form"} className="mt-4 space-y-4">
      <FormError message={!state?.ok ? state?.error : undefined} />
      <FormGrid cols={1}>
        <Field label="Senha atual" required error={fe("currentPassword")}>
          <TextInput type="password" name="currentPassword" required />
        </Field>
        <Field label="Nova senha" required error={fe("newPassword")} hint="Mínimo 8 caracteres">
          <TextInput type="password" name="newPassword" required minLength={8} />
        </Field>
      </FormGrid>
      {state?.ok && (
        <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Senha atualizada com sucesso.
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Trocar senha"}</button>
    </form>
  );
}
