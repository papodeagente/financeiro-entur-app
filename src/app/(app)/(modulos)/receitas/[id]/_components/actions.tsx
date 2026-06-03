"use client";
import { useState, useTransition, useEffect } from "react";
import { CheckCircle2, MessageSquare, X, Copy, AlertTriangle, Info } from "lucide-react";
import { validateSale, rejectSale, requestAdjustment, markDuplicate } from "@/lib/actions/sales";
import { analyzeSaleAction } from "@/lib/actions/sales-analysis";
import type { SaleWarning } from "@/lib/sale-analysis";

export function ValidationActions({ saleId }: { saleId: string }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [openMode, setOpenMode] = useState<"validate" | "adjust" | "reject" | "duplicate" | null>(null);

  async function doAction() {
    start(async () => {
      if (openMode === "validate") await validateSale(saleId);
      else if (openMode === "adjust") await requestAdjustment(saleId, reason);
      else if (openMode === "reject") await rejectSale(saleId, reason);
      else if (openMode === "duplicate") await markDuplicate(saleId);
      setOpenMode(null); setReason("");
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Validação financeira</h3>
      <p className="text-xs text-ink-muted">Ao validar, geram-se parcelas + comissão e a venda passa a contar nos relatórios oficiais.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpenMode("validate")} className="btn-primary">
          <CheckCircle2 className="h-4 w-4" /> Validar venda
        </button>
        <button onClick={() => setOpenMode("adjust")} className="btn-secondary">
          <MessageSquare className="h-4 w-4" /> Solicitar ajuste
        </button>
        <button onClick={() => setOpenMode("reject")} className="btn-secondary text-danger">
          <X className="h-4 w-4" /> Reprovar
        </button>
        <button onClick={() => setOpenMode("duplicate")} className="btn-secondary">
          <Copy className="h-4 w-4" /> Marcar duplicada
        </button>
      </div>

      {openMode && (
        <div className="card-soft p-4 space-y-3">
          <p className="text-sm text-ink font-medium">
            {openMode === "validate" && "Confirmar validação?"}
            {openMode === "adjust" && "Qual o motivo do ajuste?"}
            {openMode === "reject" && "Qual o motivo da reprovação?"}
            {openMode === "duplicate" && "Confirmar marcação como duplicada?"}
          </p>
          {(openMode === "adjust" || openMode === "reject") && (
            <textarea
              autoFocus
              className="input min-h-[80px]"
              placeholder="Mínimo 3 caracteres"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setOpenMode(null); setReason(""); }} className="btn-secondary">Cancelar</button>
            <button
              onClick={doAction}
              className={openMode === "validate" ? "btn-primary" : "btn-secondary"}
              disabled={pending || ((openMode === "adjust" || openMode === "reject") && reason.trim().length < 3)}
            >
              {pending ? "Processando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ValidationAnalysis({ saleId: _saleId, customerId, productId, netAmount, saleDate, receiptUrl, contractUrl }: {
  saleId: string; customerId: string; productId: string; netAmount: number; saleDate: string; receiptUrl?: string; contractUrl?: string;
}) {
  const [warnings, setWarnings] = useState<SaleWarning[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const res = await analyzeSaleAction({ customerId, productId, netAmount, saleDate, receiptUrl, contractUrl });
      if (res.ok) setWarnings(res.data ?? []);
    });
  }, [customerId, productId, netAmount, saleDate, receiptUrl, contractUrl]);

  if (pending && !warnings) {
    return <div className="card-soft p-4 text-sm text-ink-muted">Rodando análise…</div>;
  }
  if (!warnings || warnings.length === 0) {
    return (
      <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" /> Análise: sem alertas. Venda parece consistente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-widest text-ink-subtle font-semibold">Análise do sistema · {warnings.length} alerta{warnings.length > 1 ? "s" : ""}</h3>
      {warnings.map((w, i) => (
        <div key={i} className={"rounded-lg border px-3 py-2 text-sm flex items-start gap-2 " + (
          w.severity === "danger" ? "border-danger/30 bg-danger/10 text-danger" :
          w.severity === "warn" ? "border-warn/30 bg-warn/10 text-warn" :
          "border-info/30 bg-info/10 text-info"
        )}>
          {w.severity === "danger" || w.severity === "warn" ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> : <Info className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
