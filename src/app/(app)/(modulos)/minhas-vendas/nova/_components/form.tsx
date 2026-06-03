"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, CheckCircle2, Search, Plus } from "lucide-react";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-actions";
import { createSale } from "@/lib/actions/sales";
import { analyzeSaleAction } from "@/lib/actions/sales-analysis";
import { upsertCustomer } from "@/lib/actions/customers";
import { saleOriginLabel } from "@/lib/validations";
import { todayISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/action-result";
import type { SaleWarning } from "@/lib/sale-analysis";

type Customer = { id: string; name: string; email: string | null; document: string | null; status: string };
type Product = { id: string; name: string; defaultPrice: { toString: () => string }; defaultCommissionPercent: { toString: () => string } | null; billing: string };
type User = { id: string; name: string; role: string };
type PM = { id: string; name: string };

export function NewSaleForm({ customers, products, users, paymentMethods, currentUserId, currentUserName }: {
  customers: Customer[]; products: Product[]; users: User[]; paymentMethods: PM[];
  currentUserId: string; currentUserName: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createSale, null);
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [grossAmount, setGrossAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0,00");
  const [feeAmount, setFeeAmount] = useState("0,00");
  const [entryAmount, setEntryAmount] = useState("0,00");
  const [installmentsCount, setInstallmentsCount] = useState("1");
  const [warnings, setWarnings] = useState<SaleWarning[]>([]);
  const [analyzing, startAnalyze] = useTransition();
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    if (state?.ok) router.push("/minhas-vendas?created=1");
  }, [state, router]);

  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  const filteredCustomers = customerSearch.trim().length >= 2
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.document ?? "").includes(customerSearch)
      ).slice(0, 10)
    : [];

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedProduct = products.find((p) => p.id === productId);

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((p) => p.id === id);
    if (p && !grossAmount) {
      setGrossAmount(Number(p.defaultPrice).toFixed(2).replace(".", ","));
    }
  }

  const parse = (s: string) => Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0;
  const grossN = parse(grossAmount);
  const discN = parse(discountAmount);
  const feeN = parse(feeAmount);
  const netN = Math.max(0, +(grossN - discN - feeN).toFixed(2));
  const nInst = Math.max(1, parseInt(installmentsCount, 10) || 1);
  const entryN = parse(entryAmount);
  const restNet = Math.max(0, netN - entryN);
  const parcelaN = nInst > 0 ? +(restNet / nInst).toFixed(2) : 0;

  function runAnalysis() {
    if (!productId || !grossAmount) return;
    setShowAnalysis(true);
    startAnalyze(async () => {
      const res = await analyzeSaleAction({
        customerId: customerId || undefined,
        customerEmail: selectedCustomer?.email ?? undefined,
        customerDocument: selectedCustomer?.document ?? undefined,
        productId,
        netAmount: netN,
        saleDate: new Date(),
      });
      if (res.ok) setWarnings(res.data ?? []);
    });
  }

  return (
    <div className="space-y-4">
      {state?.ok === false && state?.error && <FormError message={state.error} />}

      <form action={formAction} className="space-y-4">
        {/* Cliente */}
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">1. Cliente</h3>
            {customerId && selectedCustomer && (
              <span className={"badge-" + (selectedCustomer.status === "INADIMPLENTE" ? "danger" : "ok")}>
                {selectedCustomer.status}
              </span>
            )}
          </div>
          {!customerId && !creatingCustomer && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
                <input
                  type="text" value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar por nome, email ou CPF/CNPJ…"
                  className="input pl-9"
                />
              </div>
              {filteredCustomers.length > 0 && (
                <div className="card-soft divide-y divide-line">
                  {filteredCustomers.map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); }}
                      className="block w-full text-left px-4 py-2 hover:bg-bg-elev">
                      <div className="text-ink">{c.name}</div>
                      <div className="text-xs text-ink-subtle">{c.email ?? "—"} · {c.document ?? "—"}</div>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setCreatingCustomer(true)} className="btn-secondary text-sm">
                <Plus className="h-4 w-4" /> Cadastrar novo cliente
              </button>
            </>
          )}
          {creatingCustomer && !customerId && (
            <NewCustomerInline
              onCreated={(c) => { setCustomerId(c.id); setCustomerSearch(c.name); setCreatingCustomer(false); customers.push(c); }}
              onCancel={() => setCreatingCustomer(false)}
            />
          )}
          {customerId && selectedCustomer && (
            <div className="card-soft p-3 flex items-center justify-between">
              <div>
                <p className="text-ink font-medium">{selectedCustomer.name}</p>
                <p className="text-xs text-ink-subtle mt-0.5">{selectedCustomer.email ?? "—"} · {selectedCustomer.document ?? "—"}</p>
              </div>
              <button type="button" onClick={() => { setCustomerId(""); setCustomerSearch(""); }} className="btn-ghost text-xs">Trocar</button>
            </div>
          )}
          <input type="hidden" name="customerId" value={customerId} />
        </section>

        {/* Produto e valores */}
        <section className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-ink">2. Produto e pagamento</h3>
          <FormGrid cols={2}>
            <Field label="Produto vendido" required error={fe("productId")} className="sm:col-span-2">
              <Select name="productId" required value={productId} onChange={(e) => onProductChange(e.target.value)}>
                <option value="" disabled>— selecione —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.billing === "RECORRENTE" ? "recorrente" : "única"})</option>)}
              </Select>
            </Field>
            <Field label="Valor total" required error={fe("grossAmount")}>
              <TextInput name="grossAmount" required value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </Field>
            <Field label="Descontos" error={fe("discountAmount")}>
              <TextInput name="discountAmount" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Taxas previstas" error={fe("feeAmount")}>
              <TextInput name="feeAmount" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Valor de entrada (se houver)" error={fe("entryAmount")}>
              <TextInput name="entryAmount" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Forma de pagamento" required error={fe("paymentMethodId")}>
              <Select name="paymentMethodId" required defaultValue="">
                <option value="" disabled>— selecione —</option>
                {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Quantidade de parcelas" required error={fe("installmentsCount")}>
              <TextInput type="number" name="installmentsCount" required min={1} max={48} value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} />
            </Field>
            <Field label="Data da venda" required error={fe("saleDate")}>
              <TextInput type="date" name="saleDate" required defaultValue={todayISODate()} />
            </Field>
            <Field label="Data do 1º pagamento" required error={fe("firstDueDate")}>
              <TextInput type="date" name="firstDueDate" required defaultValue={todayISODate()} />
            </Field>
          </FormGrid>

          <div className="card-soft p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Sum label="Bruto" value={grossN} />
            <Sum label="Desc + taxas" value={-(discN + feeN)} />
            <Sum label="Líquido" value={netN} highlight />
            <Sum label={`${nInst}× restante`} value={parcelaN} highlight />
          </div>
        </section>

        {/* Comercial */}
        <section className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-ink">3. Comercial</h3>
          <FormGrid cols={2}>
            <Field label="Vendedor responsável" required error={fe("sellerId")} hint="Você, por padrão. Pode atribuir outro vendedor.">
              <Select name="sellerId" required defaultValue={currentUserId}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} {u.id === currentUserId ? "(você)" : ""}</option>)}
              </Select>
            </Field>
            <Field label="SDR responsável (se houver)" error={fe("sdrId")}>
              <Select name="sdrId" defaultValue="">
                <option value="">— sem SDR —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="Origem" required error={fe("origin")}>
              <Select name="origin" required defaultValue="OUTBOUND">
                {Object.entries(saleOriginLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Campanha (se houver)" error={fe("campaign")} hint="Ex: Lançamento OSA Maio 2026">
              <TextInput name="campaign" placeholder="Nome da campanha" />
            </Field>
            <Field label="Turma / Cohort (se houver)" error={fe("cohort")} className="sm:col-span-2">
              <TextInput name="cohort" placeholder="Ex: Trekker Turma 12" />
            </Field>
          </FormGrid>
        </section>

        {/* Anexos & observações */}
        <section className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-ink">4. Anexos e observações</h3>
          <FormGrid cols={1}>
            <Field label="Link do contrato (URL)" error={fe("contractUrl")} hint="Drive, Notion, PDF público ou similar.">
              <TextInput name="contractUrl" placeholder="https://…" />
            </Field>
            <Field label="Link do comprovante de pagamento (URL)" error={fe("receiptUrl")} hint="Print do PIX, recibo do cartão, etc.">
              <TextInput name="receiptUrl" placeholder="https://…" />
            </Field>
            <Field label="Link da negociação no CRM (se houver)" error={fe("crmLink")}>
              <TextInput name="crmLink" placeholder="https://…" />
            </Field>
            <Field label="Observações comerciais">
              <TextArea name="notes" placeholder="Detalhes da negociação, expectativas do cliente, condições especiais." />
            </Field>
          </FormGrid>
        </section>

        {/* Análise prévia + warnings */}
        <section className="card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">5. Análise prévia</h3>
            <button type="button" onClick={runAnalysis} className="btn-secondary text-sm" disabled={!productId || !grossAmount || analyzing}>
              {analyzing ? "Analisando…" : "Rodar análise"}
            </button>
          </div>
          <p className="text-xs text-ink-subtle">O sistema verifica duplicatas, valor fora do padrão, cliente inadimplente e compras ativas do mesmo produto.</p>

          {showAnalysis && !analyzing && (
            <div className="space-y-2">
              {warnings.length === 0 ? (
                <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Tudo certo. Sem alertas no momento.
                </div>
              ) : (
                warnings.map((w, i) => (
                  <div key={i} className={"rounded-lg border px-3 py-2 text-sm flex items-start gap-2 " + (
                    w.severity === "danger" ? "border-danger/30 bg-danger/10 text-danger" :
                    w.severity === "warn" ? "border-warn/30 bg-warn/10 text-warn" :
                    "border-info/30 bg-info/10 text-info"
                  )}>
                    {w.severity === "danger" || w.severity === "warn" ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> : <Info className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{w.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Hidden: campos default */}
        <input type="hidden" name="commissionPercent" value={selectedProduct?.defaultCommissionPercent?.toString() ?? ""} />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-line">
          <p className="text-xs text-ink-muted">
            <strong className="text-ink">Status inicial:</strong> Aguardando validação financeira. O financeiro vai conferir e validar — só então geram-se os recebíveis e a comissão.
          </p>
          <button type="submit" className="btn-primary" disabled={pending || !customerId || !productId || !grossAmount}>
            {pending ? "Enviando…" : "Lançar venda pra validação"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewCustomerInline({ onCreated, onCancel }: { onCreated: (c: { id: string; name: string; email: string | null; document: string | null; status: string }) => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertCustomer, null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [document, setDocument] = useState("");
  useEffect(() => {
    if (state?.ok) {
      // Sem retornar o ID, vamos recarregar. Como upsertCustomer não retorna o id, faço fetch direto:
      fetch("/api/customers/last", { method: "GET" }).then(async (r) => {
        if (r.ok) { const c = await r.json(); onCreated(c); }
      });
    }
  }, [state, onCreated]);

  return (
    <form action={formAction} className="card-soft p-4 space-y-3">
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
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary" disabled={pending || !name}>{pending ? "Criando…" : "Criar cliente"}</button>
      </div>
    </form>
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
