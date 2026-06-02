"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { UserPlus, Power, Copy, X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { inviteUser, toggleUserActive, revokeInvitation } from "@/lib/actions/users";
import { dateTimeBR } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const roles = [
  { value: "ADMIN", label: "Admin (acesso total)" },
  { value: "FINANCEIRO", label: "Financeiro (operar tudo)" },
  { value: "COMERCIAL", label: "Comercial (só vê próprios clientes/vendas)" },
  { value: "GESTOR", label: "Gestor (visualiza relatórios)" },
  { value: "CONSULTOR", label: "Consultor (só vê suas vendas)" },
  { value: "READONLY", label: "Somente leitura" },
];

export function InviteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Convidar usuário
      </button>
      <InviteDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function InviteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult<{ acceptUrl: string; emailSent: boolean }> | null, FormData>(inviteUser, null);
  const [snapshot, setSnapshot] = useState(0);
  useEffect(() => { if (open) setSnapshot((s) => s + 1); }, [open]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;
  const success = state?.ok ? state.data : null;

  return (
    <Drawer open={open} onClose={onClose} title="Convidar usuário" description="Email com link de criação de senha será enviado. Convite válido por 7 dias.">
      {success ? (
        <SuccessPanel acceptUrl={success.acceptUrl} emailSent={success.emailSent} onDone={onClose} />
      ) : (
        <form action={formAction} key={snapshot} className="space-y-4">
          <FormError message={!state?.ok ? state?.error : undefined} />
          <FormGrid cols={1}>
            <Field label="Nome" required error={fe("name")}><TextInput name="name" required autoFocus /></Field>
            <Field label="Email" required error={fe("email")}><TextInput type="email" name="email" required /></Field>
            <Field label="Perfil" required error={fe("role")}>
              <Select name="role" required defaultValue="COMERCIAL">
                {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
          </FormGrid>
          <FormFooter onCancel={onClose} submitting={pending} submitLabel="Criar convite" />
        </form>
      )}
    </Drawer>
  );
}

function SuccessPanel({ acceptUrl, emailSent, onDone }: { acceptUrl: string; emailSent: boolean; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(acceptUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  return (
    <div className="space-y-4">
      <div className={"rounded-lg border px-3 py-3 text-sm " + (emailSent ? "border-ok/30 bg-ok/10 text-ok" : "border-warn/30 bg-warn/10 text-warn")}>
        {emailSent ? "✓ Convite enviado por email." : "⚠ Email não configurado (RESEND_API_KEY). Copie o link e mande manualmente."}
      </div>
      <div className="card-soft p-3">
        <p className="text-[11px] uppercase tracking-widest text-ink-subtle mb-1">Link do convite</p>
        <p className="text-xs text-ink-muted break-all">{acceptUrl}</p>
        <button onClick={copy} className="btn-secondary mt-3 text-xs">
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado!" : "Copiar link"}
        </button>
      </div>
      <button onClick={onDone} className="btn-primary w-full">Concluir</button>
    </div>
  );
}

export function UserActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn-ghost p-1.5" title={active ? "Desativar" : "Reativar"} disabled={pending}
      onClick={() => { if (confirm(active ? "Desativar usuário?" : "Reativar usuário?")) start(async () => { await toggleUserActive(id); }); }}>
      <Power className="h-3.5 w-3.5" />
    </button>
  );
}

export function InvitationRow({ id, email, name, role, token, expiresAt }: { id: string; email: string; name: string; role: string; token: string; expiresAt: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/aceitar-convite/${token}` : `/aceitar-convite/${token}`;
  function copy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  return (
    <div className="card-soft p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-ink truncate">{name} <span className="text-ink-subtle">· {email}</span></p>
        <p className="text-[11px] text-ink-subtle">{role} · expira {dateTimeBR(expiresAt)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={copy} className="btn-ghost p-1.5" title={copied ? "Copiado" : "Copiar link"}><Copy className="h-3.5 w-3.5" /></button>
        <button className="btn-ghost p-1.5" title="Revogar" disabled={pending}
          onClick={() => { if (confirm("Revogar convite?")) start(async () => { await revokeInvitation(id); }); }}>
          <X className="h-3.5 w-3.5 text-danger" />
        </button>
      </div>
    </div>
  );
}
