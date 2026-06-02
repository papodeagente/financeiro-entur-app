"use client";
import { useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { CategoryFormDrawer, type CategoryRow } from "./category-form";
import { toggleCategoryActive } from "@/lib/actions/categories";

export function NewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova categoria
      </button>
      <CategoryFormDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RowActions({ row }: { row: CategoryRow & { active: boolean } }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        className="btn-ghost p-1.5"
        title={row.active ? "Desativar" : "Reativar"}
        disabled={pending}
        onClick={() => start(async () => { await toggleCategoryActive(row.id); })}
      >
        <Power className="h-3.5 w-3.5" />
      </button>
      <CategoryFormDrawer open={open} onClose={() => setOpen(false)} initial={row} />
    </div>
  );
}
