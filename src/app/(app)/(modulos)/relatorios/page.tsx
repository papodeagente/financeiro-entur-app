import { PageShell } from "@/components/layout/page-shell";
import { reports } from "@/lib/reports";
import { FileBarChart, FileSpreadsheet, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Page() {
  const groups = reports.reduce<Record<string, typeof reports>>((acc, r) => {
    (acc[r.group] ||= []).push(r);
    return acc;
  }, {});

  return (
    <PageShell
      title="Relatórios estratégicos"
      description="Análises para tomada de decisão. Cada relatório tem exportação em CSV (compatível com Excel)."
    >
      <div className="space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <h3 className="text-xs uppercase tracking-widest text-ink-subtle mb-3 font-semibold">{group}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((r) => (
                <Link
                  key={r.slug}
                  href={`/relatorios/${r.slug}`}
                  className="card p-5 hover:ring-1 hover:ring-brand-500/40 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30">
                      <FileBarChart className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-ink-subtle group-hover:text-magenta-400 transition" />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-ink">{r.name}</h4>
                  <p className="mt-1 text-xs text-ink-muted line-clamp-2">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="card p-6 mt-6">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-magenta-400" /> Importar CSV
        </h3>
        <p className="mt-1 text-sm text-ink-muted">Suba uma planilha de clientes pra cadastro em massa.</p>
        <Link href="/relatorios/importar/clientes" className="btn-secondary mt-3 inline-flex">Abrir importador</Link>
      </div>
    </PageShell>
  );
}
