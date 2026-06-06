"use client";
import { useTransition } from "react";
import Link from "next/link";
import { Plus, Pencil, Power } from "lucide-react";
import { toggleProductActive } from "@/lib/actions/products";

export type ProductRow = {
  id: string; name: string; description: string | null;
  type: string; billing: string;
  defaultPrice: string;
  estimatedCost: string | null; estimatedMargin: string | null;
  defaultCommissionPercent: string | null;
  accessDurationDays: number | null;
  categoryId: string | null; costCenterId: string | null;
  active: boolean; notes: string | null;
};
export type Option = { id: string; name: string };

export function NewButton(_props?: { categories?: Option[]; costCenters?: Option[] }) {
  return (
    <Link href="/produtos/novo" className="btn-primary">
      <Plus className="h-4 w-4" /> Novo produto
    </Link>
  );
}

export function RowActions({ row }: { row: ProductRow; categories?: Option[]; costCenters?: Option[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/produtos/${row.id}/editar`} className="btn-ghost p-1.5" title="Editar">
        <Pencil className="h-3.5 w-3.5" />
      </Link>
      <button className="btn-ghost p-1.5" title={row.active ? "Desativar" : "Reativar"} disabled={pending}
        onClick={() => start(async () => { await toggleProductActive(row.id); })}>
        <Power className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
