"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Pause, Play, X, CreditCard } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertSubscription, pauseSubscription, cancelSubscription, reactivateSubscription, registerSubscriptionCharge } from "@/lib/actions/subscriptions";
import { subscriptionPeriodLabel } from "@/lib/validations";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type Opt = { id: string; name: string };
export type ProductOpt = Opt & { defaultPrice: string };
export type SubRow = {
  id: string; customerId: string; productId: string;
  amount: string; period: string; startDate: string;
  nextChargeAt: string | null; paymentMethodId: string | null;
  expiresAt: string | null; status: string;
};

function FormDrawer({
  open, onClose, initial, customers, products, paymentMethods,
}: { open: boolean; onClose: () => void; initial?: SubRow | null; customers: Opt[]; products: ProductOpt[]; paymentMethods: Opt[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertSubscription, null);
  const [snapshot, setSnapshot] = useState(0);
  const [productId, setProductId] = useState(initial?.productId ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  useEffect(() => {
    if (open) {
      setSnapshot((s) => s + 1);
      setProductId(initial?.productId ?? "");
      setAmount(initial?.amount ?? "");
    }
  }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((p) => p.id === id);
    if (p && !initial) setAmount(Number(p.defaultPrice).toFixed(2).replace(".", ","));
  }

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-xl"
      title={initial ? "Editar assinatura" : "Nova assinatura"}
      description="Cobranças recorrentes (mensal, trimestral, semestral, anual)."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Cliente" required error={fe("customerId")} className="sm:col-span-2">
            <Select name="customerId" required defaultValue={initial?.customerId ?? ""}>
              <option value="" disabled>— selecione —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Produto" required error={fe("productId")} className="sm:col-span-2">
            <Select name="productId" required value={productId} onChange={(e) => onProductChange(e.target.value)}>
              <option value="" disabled>— selecione —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Valor recorrente" required error={fe("amount")}>
            <TextInput name="amount" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Periodicidade" required error={fe("period")}>
            <Select name="period" required defaultValue={initial?.period ?? "MENSAL"}>
              {Object.entries(subscriptionPeriodLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Data de início" required error={fe("startDate")}>
            <TextInput type="date" name="startDate" required defaultValue={initial?.startDate?.slice(0, 10) ?? todayISODate()} />
          </Field>
          <Field label="Próxima cobrança (opcional)" error={fe("nextChargeAt")} hint="Vazio = calcula pelo período">
            <TextInput type="date" name="nextChargeAt" defaultValue={initial?.nextChargeAt?.slice(0, 10) ?? ""} />
          </Field>
          <Field label="Método de pagamento" error={fe("paymentMethodId")} className="sm:col-span-2">
            <Select name="paymentMethodId" defaultValue={initial?.paymentMethodId ?? ""}>
              <option value="">—</option>
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Expira em (opcional)" error={fe("expiresAt")} hint="Para assinaturas com prazo fixo" className="sm:col-span-2">
            <TextInput type="date" name="expiresAt" defaultValue={initial?.expiresAt?.slice(0, 10) ?? ""} />
          </Field>
        </FormGrid>
        <FormFooter onCancel={onClose} submitting={pending} />
      </form>
    </Drawer>
  );
}

export function NewButton(props: { customers: Opt[]; products: ProductOpt[]; paymentMethods: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova assinatura
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

export function RowActions({
  row, customers, products, paymentMethods, bankAccounts,
}: { row: SubRow; customers: Opt[]; products: ProductOpt[]; paymentMethods: Opt[]; bankAccounts: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const active = row.status === "ATIVA";
  const paused = row.status === "PAUSADA";
  const cancelled = row.status === "CANCELADA";
  return (
    <div className="flex items-center justify-end gap-1">
      {active && (
        <button className="btn-ghost p-1.5" title="Registrar cobrança recebida" disabled={pending}
          onClick={() => {
            const ba = bankAccounts.length === 1 ? bankAccounts[0].id : prompt("Conta bancária para creditar (ID, opcional)") ?? undefined;
            start(async () => { await registerSubscriptionCharge(row.id, ba && ba.length > 0 ? ba : undefined); });
          }}>
          <CreditCard className="h-3.5 w-3.5 text-ok" />
        </button>
      )}
      <button className="btn-ghost p-1.5" title="Editar" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /></button>
      {active && (
        <button className="btn-ghost p-1.5" title="Pausar" disabled={pending}
          onClick={() => start(async () => { await pauseSubscription(row.id); })}>
          <Pause className="h-3.5 w-3.5 text-warn" />
        </button>
      )}
      {paused && (
        <button className="btn-ghost p-1.5" title="Reativar" disabled={pending}
          onClick={() => start(async () => { await reactivateSubscription(row.id); })}>
          <Play className="h-3.5 w-3.5 text-ok" />
        </button>
      )}
      {!cancelled && (
        <button className="btn-ghost p-1.5" title="Cancelar" disabled={pending}
          onClick={() => { if (confirm("Cancelar assinatura?")) start(async () => { await cancelSubscription(row.id); }); }}>
          <X className="h-3.5 w-3.5 text-danger" />
        </button>
      )}
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} customers={customers} products={products} paymentMethods={paymentMethods} />
    </div>
  );
}
