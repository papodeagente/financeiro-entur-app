"use client";
import { useActionState } from "react";
import { Field, TextInput } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-actions";
import { requestPasswordReset } from "@/lib/actions/users";
import type { ActionResult } from "@/lib/action-result";

export function RequestForm() {
  const [state, formAction, pending] = useActionState<ActionResult<{ resetUrl?: string; emailSent: boolean }> | null, FormData>(requestPasswordReset, null);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  if (state?.ok) {
    return (
      <div className="mt-6 space-y-3">
        <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-3 text-sm text-ok">
          Se houver conta com esse email, enviamos o link de redefinição.
        </div>
        {state.data?.resetUrl && (
          <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            <p className="font-medium mb-1">⚠ Email não configurado (RESEND_API_KEY). Use este link:</p>
            <a href={state.data.resetUrl} className="break-all underline">{state.data.resetUrl}</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <FormError message={!state?.ok ? state?.error : undefined} />
      <Field label="Email" required error={fe("email")}>
        <TextInput type="email" name="email" required autoFocus placeholder="voce@entur.com.br" />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
