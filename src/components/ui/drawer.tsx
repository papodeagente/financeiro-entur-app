"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open, onClose, title, description, children, footer, widthClass = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className={cn("fixed inset-0 z-50 pointer-events-none", open ? "" : "")} aria-hidden={!open}>
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        role="dialog" aria-modal="true"
        className={cn(
          "absolute right-0 top-0 h-full w-full bg-bg-card border-l border-line shadow-2xl",
          "transition-transform duration-300 ease-out flex flex-col",
          widthClass,
          open ? "translate-x-0 pointer-events-auto" : "translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-line">
          <div>
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            {description && <p className="text-sm text-ink-muted mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost p-2 -mr-2" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line bg-bg-soft/40">{footer}</div>}
      </div>
    </div>
  );
}
