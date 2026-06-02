"use client";
import { useActionState, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertReconciliation } from "@/lib/actions/reconciliations";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type ReconcileRow = {
  installmentId: string; grossAmount: string; paidAmount: string; description: string;
  existing?: {
    platformFee: string; gatewayFee: string; netAmount: string; receivedAt: string;
    bankAccountId: string | null; notes: string | null; status: string;
  } | null;
};
export type Opt = { id: string; name: string };

export function ReconcileButton({ row, bankAccounts }: { row: ReconcileRow; bankAccounts: Opt[] }) {
  const [open, setOpen] = useState(false);
  const label = row.existing ? (row.existing.status === "CONCILIADO" ? "Reconciliar" : "Resolver") : "Conciliar";
  return (
    <>
      <button className="btn-ghost text-xs flex items-center gap-1.5" onClick={() => setOpen(true)}>
        <CheckCircle2 className="h-3.5 w-3.5" /> {label}
      </button>
      <ReconcileDrawer open={open} onClose={() => setOpen(false)} row={row} bankAccounts={bankAccounts} />
    </>
  );
}

function ReconcileDrawer({ open, onClose, row, bankAccounts }: { open: boolean; onClose: () => void; row: ReconcileRow; bankAccounts: Opt[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertReconciliation, null);
  const [snapshot, setSnapshot] = useState(0);
  const [platformFee, setPlatformFee] = useState(row.existing?.platformFee ?? "0,00");
  const [gatewayFee, setGatewayFee] = useState(row.existing?.gatewayFee ?? "0,00");
  const [netAmount, setNetAmount] = useState(row.existing?.netAmount ?? Number(row.grossAmount).toFixed(2).replace(".", ","));

  useEffect(() => {
    if (open) {
      setSnapshot((s) => s + 1);
      setPlatformFee(row.existing?.platformFee ?? "0,00");
      setGatewayFee(row.existing?.gatewayFee ?? "0,00");
      setNetAmount(row.existing?.netAmount ?? Number(row.grossAmount).toFixed(2).replace(".", ","));
    }
  }, [open, row]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  const parse = (s: string) => Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0;
  const gross = parse(row.grossAmount);
  const expected = gross - parse(platformFee) - parse(gatewayFee);
  const diff = parse(netAmount) - expected;
  const ok = Math.abs(diff) < 0.01;

  return (
    <Drawer open={open} onClose={onClose} title="Conciliação de recebimento" description={row.description}>
      <form action={formAction} key={snapshot} className="space-y-4">
        <input type="hidden" name="installmentId" defaultValue={row.installmentId} />
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Valor bruto da venda">
            <TextInput value={gross.toFixed(2).replace(".", ",")} disabled />
          </Field>
          <Field label="Taxa da plataforma" error={fe("platformFee")} hint="Hotmart, Eduzz, Kiwify…">
            <TextInput name="platformFee" value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Taxa do gateway" error={fe("gatewayFee")} hint="Stripe, Asaas, Mercado Pago…">
            <TextInput name="gatewayFee" value={gatewayFee} onChange={(e) => setGatewayFee(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Valor líquido recebido" required error={fe("netAmount")}>
            <TextInput name="netAmount" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} required inputMode="decimal" />
          </Field>
          <Field label="Data de recebimento" required error={fe("receivedAt")}>
            <TextInput type="date" name="receivedAt" required defaultValue={row.existing?.receivedAt?.slice(0, 10) ?? todayISODate()} />
          </Field>
          <Field label="Conta de destino" error={fe("bankAccountId")}>
            <Select name="bankAccountId" defaultValue={row.existing?.bankAccountId ?? ""}>
              <option value="">—</option>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea name="notes" defaultValue={row.existing?.notes ?? ""} placeholder="Notas sobre divergências, lotes, fechamento mensal." />
          </Field>
        </FormGrid>

        <div className={"card-soft p-3 text-xs " + (ok ? "text-ok" : "text-warn")}>
          {ok ? (
            <>✓ Líquido esperado <strong>{expected.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> bate com o informado. Será marcado como <strong>conciliado</strong>.</>
          ) : (
            <>⚠ Divergência de <strong>{Math.abs(diff).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>: esperado {expected.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, informado {parse(netAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Será marcado como <strong>divergente</strong>.</>
          )}
        </div>
        <FormFooter onCancel={onClose} submitting={pending} submitLabel="Salvar conciliação" />
      </form>
    </Drawer>
  );
}
