"use client";

export function FormFooter({
  onCancel, submitting, submitLabel = "Salvar",
}: { onCancel: () => void; submitting: boolean; submitLabel?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn-secondary" disabled={submitting}>
        Cancelar
      </button>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Salvando…" : submitLabel}
      </button>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}
