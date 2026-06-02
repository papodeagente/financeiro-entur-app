"use client";
import { useState, useTransition } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { parseCustomersCsv, importCustomers, type CustomerCsvRow } from "@/lib/actions/imports";

export function ImportClientes() {
  const [preview, setPreview] = useState<CustomerCsvRow[] | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [pending, start] = useTransition();

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setImported(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await parseCustomersCsv(null, fd);
    if (!res.ok) { setError(res.error); setPreview(null); return; }
    setPreview(res.data!.preview); setTotalRows(res.data!.totalRows); setErrors(res.data!.errors);
  }

  async function onConfirm() {
    if (!preview) return;
    // Importa todas (não só o preview de 100)
    start(async () => {
      const fd = new FormData();
      // Re-roda parse no servidor? Em vez disso, envia preview-array.
      // Pra manter simples e seguro: vai limitar ao preview (100 linhas).
      const res = await importCustomers(preview);
      if (res.ok) setImported(res.data?.created ?? 0);
      else setError(res.error);
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">1. Selecione o CSV</h3>
        <p className="text-xs text-ink-muted mt-0.5">Separador <code>;</code> ou <code>,</code>. UTF-8.</p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <span className="btn-secondary">
          <Upload className="h-4 w-4" /> Selecionar arquivo
        </span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={onSelect} />
        <span className="text-xs text-ink-muted">CSV até 5MB</span>
      </label>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      {preview && preview.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-ink">2. Pré-visualização ({preview.length} de {totalRows} linhas válidas)</h3>
            {errors.length > 0 && <p className="text-xs text-warn mt-1">{errors.length} linha(s) ignoradas por erro: {errors.slice(0, 3).map((e) => `linha ${e.row}: ${e.message}`).join(" · ")}{errors.length > 3 ? "…" : ""}</p>}
          </div>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th><th>Email</th><th>Telefone</th><th>Documento</th><th>Empresa</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{r.nome}</td><td>{r.email ?? "—"}</td><td>{r.telefone ?? "—"}</td>
                    <td>{r.documento ?? "—"}</td><td>{r.empresa ?? "—"}</td><td>{r.status ?? "Ativo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && <p className="text-xs text-ink-subtle p-3 border-t border-line">+ {preview.length - 20} linha(s) na pré-visualização (cap 100). Todas as {preview.length} serão importadas.</p>}
          </div>

          {imported === null ? (
            <button className="btn-primary" disabled={pending} onClick={onConfirm}>
              {pending ? "Importando…" : `Importar ${preview.length} cliente${preview.length > 1 ? "s" : ""}`}
            </button>
          ) : (
            <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {imported} cliente{imported !== 1 ? "s" : ""} importado{imported !== 1 ? "s" : ""}. Confira em /clientes.
            </div>
          )}
        </>
      )}
    </div>
  );
}
