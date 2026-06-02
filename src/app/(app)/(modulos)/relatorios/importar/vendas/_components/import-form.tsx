"use client";
import { useState, useTransition } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseSalesFile, importSales, type ParsePreview } from "@/lib/actions/import-sales";
import type { SaleImportRow } from "@/lib/imports/sales-parsers";

type Opt = { id: string; name: string };

export function ImportSales({ sellers }: { sellers: Opt[] }) {
  const [platform, setPlatform] = useState<"hotmart" | "eduzz" | "kiwify" | "generic">("hotmart");
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ created: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();
  const [createMissingProducts, setCreateMissingProducts] = useState(true);
  const [createMissingCustomers, setCreateMissingCustomers] = useState(true);
  const [skipPaid, setSkipPaid] = useState(true);
  const [defaultSellerId, setDefaultSellerId] = useState<string>("");

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setImported(null); setPreview(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("platform", platform);
    const res = await parseSalesFile(null, fd);
    if (!res.ok) { setError(res.error); return; }
    setPreview(res.data!);
  }

  async function onConfirm() {
    if (!preview) return;
    start(async () => {
      const res = await importSales(preview.preview, {
        platform, defaultSellerId: defaultSellerId || undefined,
        createMissingProducts, createMissingCustomers, skipPaid,
      });
      if (res.ok) setImported(res.data!);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink">1. Plataforma de origem</h3>
        <div className="flex flex-wrap gap-2">
          {(["hotmart", "eduzz", "kiwify", "generic"] as const).map((p) => (
            <button key={p} type="button"
              onClick={() => setPlatform(p)}
              className={"rounded-full px-3 py-1 text-xs ring-1 capitalize " + (platform === p ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-bg-elev text-ink-muted ring-line hover:text-ink")}>
              {p}
            </button>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-ink pt-2">2. Selecione o CSV</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="btn-secondary">
            <Upload className="h-4 w-4" /> Selecionar arquivo
          </span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onSelect} />
          <span className="text-xs text-ink-muted">CSV até 10MB</span>
        </label>

        {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
      </div>

      {preview && preview.preview.length > 0 && (
        <>
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-ink">3. Configurações da importação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={createMissingCustomers} onChange={(e) => setCreateMissingCustomers(e.target.checked)} className="accent-magenta-500" />
                <span className="text-ink-muted">Criar clientes ausentes automaticamente</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={createMissingProducts} onChange={(e) => setCreateMissingProducts(e.target.checked)} className="accent-magenta-500" />
                <span className="text-ink-muted">Criar produtos ausentes automaticamente</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
                <input type="checkbox" checked={skipPaid} onChange={(e) => setSkipPaid(e.target.checked)} className="accent-magenta-500" />
                <span className="text-ink-muted">Importar todas as parcelas como <strong className="text-ink">PAGAS</strong> (histórico já realizado)</span>
              </label>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-widest text-ink-subtle mb-1">Vendedor padrão (opcional)</label>
                <select value={defaultSellerId} onChange={(e) => setDefaultSellerId(e.target.value)} className="input">
                  <option value="">— sem vendedor —</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-3">
            <h3 className="text-sm font-semibold text-ink">4. Pré-visualização</h3>
            <p className="text-xs text-ink-muted">{preview.preview.length} de {preview.totalRows} linhas válidas. {preview.parseErrors.length > 0 && <span className="text-warn">{preview.parseErrors.length} ignoradas por erro.</span>}</p>
            {preview.unmatchedProducts.length > 0 && (
              <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <strong>Produtos não encontrados no cadastro</strong> ({preview.unmatchedProducts.length}): {preview.unmatchedProducts.slice(0, 5).join(", ")}{preview.unmatchedProducts.length > 5 ? "…" : ""}.
                  {createMissingProducts ? <> Serão criados automaticamente.</> : <> Serão pulados.</>}
                </div>
              </div>
            )}
            <div className="card overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr><th>Data</th><th>Cliente</th><th>Produto</th><th className="text-right">Bruto</th><th className="text-right">Líquido</th><th>Parcelas</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 20).map((r) => (
                    <tr key={r.rowNumber}>
                      <td>{r.saleDate}</td>
                      <td>{r.customerName}</td>
                      <td>{r.productName}</td>
                      <td className="text-right">{r.grossAmount.toFixed(2).replace(".", ",")}</td>
                      <td className="text-right">{r.netAmount.toFixed(2).replace(".", ",")}</td>
                      <td>{r.installmentsCount}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.preview.length > 20 && <p className="text-xs text-ink-subtle p-3 border-t border-line">+ {preview.preview.length - 20} linhas na pré-visualização (cap 100). Todas as {preview.preview.length} serão importadas.</p>}
            </div>

            {imported ? (
              <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {imported.created} venda{imported.created !== 1 ? "s" : ""} importada{imported.created !== 1 ? "s" : ""}. {imported.skipped > 0 && `${imported.skipped} pulada(s).`} Confira em /receitas.
              </div>
            ) : (
              <button className="btn-primary" disabled={pending} onClick={onConfirm}>
                {pending ? "Importando…" : `Importar ${preview.preview.length} venda${preview.preview.length > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
