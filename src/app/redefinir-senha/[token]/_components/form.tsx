"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field, TextInput } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-actions";
import { completePasswordReset } from "@/lib/actions/users";
import type { ActionResult } from "@/lib/action-result";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(completePasswordReset, null);
  useEffect(() => { if (state?.ok) router.push("/login?reset=1"); }, [state, router]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" defaultValue={token} />
      <FormError message={!state?.ok ? state?.error : undefined} />
      <Field label="Nova senha" required error={fe("password")} hint="Mínimo 8 caracteres.">
        <TextInput type="password" name="password" required minLength={8} autoFocus />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Salvando…" : "Redefinir senha"}
      </button>
    </form>
  );
}
