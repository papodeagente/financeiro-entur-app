import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { reportBySlug, type ReportRowGeneric } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { slug } = await params;
  const { from, to } = await searchParams;
  const def = reportBySlug.get(slug);
  if (!def) notFound();

  const filters = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
  const rows = await def.load(filters);
  const totals = def.totalsLine ? def.totalsLine(rows) : null;

  const cols: Column<ReportRowGeneric & { id?: string }>[] = def.uiColumns.map((c) => ({
    header: c.header,
    width: c.width,
    className: c.align === "right" ? "text-right" : undefined,
    cell: (r) => {
      const val = r[c.key as string];
      if (val === null || val === undefined) return <span className="text-ink-subtle">—</span>;
      if (c.cell) return c.cell(r);
      return val instanceof Date ? val.toLocaleDateString("pt-BR") : String(val);
    },
  }));

  // Add IDs for DataTable
  const withIds = rows.map((r, i) => ({ ...r, id: String(i) })) as (ReportRowGeneric & { id: string })[];

  const exportUrl = `/api/export/${slug}` + (from || to ? `?${new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => !!v) as [string, string][]).toString()}` : "");

  return (
    <PageShell
      title={def.name}
      description={def.description}
      actions={
        <a href={exportUrl} className="btn-primary">
          <Download className="h-4 w-4" /> Exportar CSV
        </a>
      }
    >
      <div className="flex items-center justify-between">
        <Link href="/relatorios" className="btn-ghost text-sm">
          <ArrowLeft className="h-4 w-4" /> Todos os relatórios
        </Link>
        <span className="text-sm text-ink-muted">{rows.length} linha{rows.length !== 1 ? "s" : ""}</span>
      </div>
      <DataTable rows={withIds} columns={cols} emptyTitle="Sem dados neste relatório." />
      {totals && (
        <div className="card-soft p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {Object.entries(totals).map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <span className="text-[11px] uppercase tracking-widest text-ink-subtle">{k}</span>
                <span className="text-ink font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
