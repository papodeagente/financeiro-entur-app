"use client";
import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { createSale } from "@/lib/actions/sales";
import { saleOriginLabel } from "@/lib/validations";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";

export type Opt = { id: string; name: string };
export type ProductOpt = Opt & { defaultPrice: string; defaultCommissionPercent: string | null; billing: string };

export function SaleFormDrawer({
  open, onClose, customers, products, sellers, paymentMethods, bankAccounts, categories, costCenters,
}: {
  open: boolean; onClose: () => void;
  customers: Opt[]; products: ProductOpt[]; sellers: Opt[];
  paymentMethods: Opt[]; bankAccounts: Opt[]; categories: Opt[]; costCenters: Opt[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createSale, null);
  const [snapshot, setSnapshot] = useState(0);
  const [productId, setProductId] = useState("");
  const [gross, setGross] = useState("");
  const [discount, setDiscount] = useState("0,00");
  const [fees, setFees] = useState("0,00");
  const [installments, setInstallments] = useState("1");
  const [commissionPercent, setCommissionPercent] = useState("");

  useEffect(() => {
    if (open) { setSnapshot((s) => s + 1); setProductId(""); setGross(""); setDiscount("0,00"); setFees("0,00"); setInstallments("1"); setCommissionPercent(""); }
  }, [open]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((p) => p.id === id);
    if (p) {
      setGross(Number(p.defaultPrice).toFixed(2).replace(".", ","));
      if (p.defaultCommissionPercent !== null) {
        setCommissionPercent(Number(p.defaultCommissionPercent).toFixed(2).replace(".", ","));
      }
    }
  }

  const parse = (s: string) => Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0;
  const grossN = parse(gross);
  const discN = parse(discount);
  const feeN = parse(fees);
  const netN = Math.max(0, +(grossN - discN - feeN).toFixed(2));
  const nInst = Math.max(1, parseInt(installments, 10) || 1);
  const parcelaN = +(netN / nInst).toFixed(2);

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-3xl"
      title="Nova venda"
      description="Cadastra a venda e gera automaticamente as parcelas de recebimento."
    >
      <form action={formAction} key={snapshot} className="space-y-4">
        <FormError message={!state?.ok ? state?.error : undefined} />
        <FormGrid cols={2}>
          <Field label="Cliente" required error={fe("customerId")}>
            <Select name="customerId" required defaultValue="">
              <option value="" disabled>— selecione —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Produto" required error={fe("productId")}>
            <Select name="productId" required value={productId} onChange={(e) => onProductChange(e.target.value)}>
              <option value="" disabled>— selecione —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Vendedor / Responsável" error={fe("sellerId")} hint="Define quem recebe a comissão">
            <Select name="sellerId" defaultValue="">
              <option value="">— sem vendedor —</option>
              {sellers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Origem da venda" required error={fe("origin")}>
            <Select name="origin" required defaultValue="ORGANICO">
              {Object.entries(saleOriginLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Data da venda" required error={fe("saleDate")}>
            <TextInput type="date" name="saleDate" required defaultValue={todayISODate()} />
          </Field>
          <Field label="Data da 1ª parcela" required error={fe("firstDueDate")} hint="As demais são geradas mês a mês.">
            <TextInput type="date" name="firstDueDate" required defaultValue={todayISODate()} />
          </Field>
          <Field label="Valor bruto" required error={fe("grossAmount")}>
            <TextInput name="grossAmount" required value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Descontos" error={fe("discountAmount")}>
            <TextInput name="discountAmount" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Taxas (gateway/plataforma)" error={fe("feeAmount")}>
            <TextInput name="feeAmount" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Comissão (%)" error={fe("commissionPercent")} hint="Sobre o líquido. Padrão do produto se vazio.">
            <TextInput name="commissionPercent" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Nº de parcelas" required error={fe("installmentsCount")}>
            <TextInput type="number" name="installmentsCount" required min={1} max={48} value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </Field>
          <Field label="Método de pagamento" error={fe("paymentMethodId")}>
            <Select name="paymentMethodId" defaultValue="">
              <option value="">—</option>
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Conta bancária destino" error={fe("bankAccountId")} hint="Pode ser definida ao receber cada parcela">
            <Select name="bankAccountId" defaultValue="">
              <option value="">—</option>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Categoria" error={fe("categoryId")}>
            <Select name="categoryId" defaultValue="">
              <option value="">— do produto —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Centro de custo" error={fe("costCenterId")}>
            <Select name="costCenterId" defaultValue="">
              <option value="">— do produto —</option>
              {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea name="notes" />
          </Field>
        </FormGrid>

        <div className="card-soft p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Sum label="Bruto" value={grossN} />
          <Sum label="Desc + taxas" value={-(discN + feeN)} />
          <Sum label="Líquido" value={netN} highlight />
          <Sum label={`${nInst}× parcela`} value={parcelaN} highlight />
        </div>

        <FormFooter onCancel={onClose} submitting={pending} submitLabel="Criar venda + parcelas" />
      </form>
    </Drawer>
  );
}

function Sum({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-ink-subtle">{label}</p>
      <p className={"mt-1 font-medium " + (highlight ? "text-ink" : "text-ink-muted")}>
        {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  );
}

type NewSaleProps = {
  customers: Opt[]; products: ProductOpt[]; sellers: Opt[];
  paymentMethods: Opt[]; bankAccounts: Opt[]; categories: Opt[]; costCenters: Opt[];
};
export function NewSaleButton(props: NewSaleProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova venda
      </button>
      <SaleFormDrawer {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
