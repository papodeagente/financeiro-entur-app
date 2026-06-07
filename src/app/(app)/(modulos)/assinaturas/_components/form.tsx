"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Pause, Play, X, CreditCard, Search, UserPlus, CheckCircle2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertSubscription, pauseSubscription, cancelSubscription, reactivateSubscription, registerSubscriptionCharge } from "@/lib/actions/subscriptions";
import { upsertCustomer } from "@/lib/actions/customers";
import { subscriptionPeriodLabel } from "@/lib/validations";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type Opt = { id: string; name: string };
export type CustomerOpt = { id: string; name: string; email?: string | null; document?: string | null };
export type ProductOpt = Opt & { defaultPrice: string };
export type SubRow = {
  id: string; customerId: string; productId: string;
  amount: string; period: string; startDate: string;
  nextChargeAt: string | null; paymentMethodId: string | null;
  expiresAt: string | null; status: string;
};

function FormDrawer({
  open, onClose, initial, customers: initialCustomers, products, paymentMethods,
}: { open: boolean; onClose: () => void; initial?: SubRow | null; customers: CustomerOpt[]; products: ProductOpt[]; paymentMethods: Opt[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertSubscription, null);
  const [snapshot, setSnapshot] = useState(0);
  const [productId, setProductId] = useState(initial?.productId ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [customers, setCustomers] = useState<CustomerOpt[]>(initialCustomers);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  useEffect(() => {
    if (open) {
      setSnapshot((s) => s + 1);
      setProductId(initial?.productId ?? "");
      setAmount(initial?.amount ?? "");
      setCustomerId(initial?.customerId ?? "");
      setCustomerSearch("");
      setCreatingCustomer(false);
      setCustomers(initialCustomers);
    }
  }, [open, initial, initialCustomers]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((p) => p.id === id);
    if (p && !initial) setAmount(Number(p.defaultPrice).toFixed(2).replace(".", ","));
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const filteredCustomers = customerSearch.trim().length >= 2
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.document ?? "").includes(customerSearch)
      ).slice(0, 10)
    : [];

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-xl"
      title={initial ? "Editar assinatura" : "Nova assinatura"}
      description="Cobranças recorrentes (mensal, trimestral, semestral, anual)."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <FormError message={!state?.ok ? state?.error : undefined} />

        {/* Cliente: busca + criar inline */}
        <Field label="Cliente" required error={fe("customerId")}>
          <input type="hidden" name="customerId" value={customerId} />
          {!customerId && !creatingCustomer && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
                <input
                  type="text" value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar nome, email ou CPF/CNPJ…"
                  className="input pl-9"
                />
              </div>
              {filteredCustomers.length > 0 && (
                <div className="rounded-lg border border-line bg-bg-soft divide-y divide-line max-h-60 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); }}
                      className="block w-full text-left px-3 py-2 hover:bg-bg-elev">
                      <div className="text-sm text-ink">{c.name}</div>
                      {(c.email || c.document) && (
                        <div className="text-[11px] text-ink-subtle mt-0.5">
                          {c.email ?? "—"}{c.document ? ` · ${c.document}` : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setCreatingCustomer(true)}
                className="btn-secondary text-sm w-full justify-center"
              >
                <UserPlus className="h-4 w-4" /> Cadastrar novo cliente
              </button>
            </div>
          )}
          {creatingCustomer && !customerId && (
            <NewCustomerInline
              defaultName={customerSearch}
              onCreated={(c) => {
                setCustomers((prev) => [c, ...prev]);
                setCustomerId(c.id);
                setCustomerSearch(c.name);
                setCreatingCustomer(false);
              }}
              onCancel={() => setCreatingCustomer(false)}
            />
          )}
          {customerId && selectedCustomer && (
            <div className="rounded-lg border border-ok/30 bg-ok/10 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-ok shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-ink font-medium truncate">{selectedCustomer.name}</p>
                  {(selectedCustomer.email || selectedCustomer.document) && (
                    <p className="text-[11px] text-ink-subtle truncate">
                      {selectedCustomer.email ?? "—"}{selectedCustomer.document ? ` · ${selectedCustomer.document}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setCustomerId(""); setCustomerSearch(""); }}
                className="btn-ghost text-xs shrink-0"
              >Trocar</button>
            </div>
          )}
        </Field>

        <FormGrid cols={2}>
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
        <FormFooter onCancel={onClose} submitting={pending || !customerId} />
      </form>
    </Drawer>
  );
}

function NewCustomerInline({ defaultName, onCreated, onCancel }: {
  defaultName?: string;
  onCreated: (c: CustomerOpt) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertCustomer, null);
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");

  useEffect(() => {
    if (state?.ok) {
      // Busca o cliente recém-criado (mais recente)
      fetch("/api/customers/last")
        .then(async (r) => { if (r.ok) onCreated(await r.json()); })
        .catch(() => {/* silent */});
    }
  }, [state, onCreated]);

  return (
    <form action={formAction} className="rounded-lg border border-line bg-bg-soft/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Novo cliente
        </p>
        <button type="button" onClick={onCancel} className="text-[11px] text-ink-subtle hover:text-ink">cancelar</button>
      </div>
      <input type="hidden" name="status" value="ATIVO" />
      <FormGrid cols={2}>
        <Field label="Nome" required className="sm:col-span-2">
          <TextInput name="name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email">
          <TextInput name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <TextInput name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="CPF / CNPJ" className="sm:col-span-2">
          <TextInput name="document" value={document} onChange={(e) => setDocument(e.target.value)} />
        </Field>
      </FormGrid>
      {state && !state.ok && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary text-sm" disabled={pending || name.trim().length < 2}>
          {pending ? "Criando…" : "Criar e continuar"}
        </button>
      </div>
    </form>
  );
}

export function NewButton(props: { customers: CustomerOpt[]; products: ProductOpt[]; paymentMethods: Opt[] }) {
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
}: { row: SubRow; customers: CustomerOpt[]; products: ProductOpt[]; paymentMethods: Opt[]; bankAccounts: Opt[] }) {
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
