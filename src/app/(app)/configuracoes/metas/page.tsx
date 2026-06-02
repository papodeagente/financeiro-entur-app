import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { brl, pct } from "@/lib/format";
import { ofMonth } from "@/lib/period";
import { NewGoalButton, GoalActions, type Opt } from "./_components/actions";

export const dynamic = "force-dynamic";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requireRole(["ADMIN", "GESTOR"]);
  const sp = await searchParams;
  const year = sp.year ? parseInt(sp.year, 10) : new Date().getFullYear();

  const [goals, users] = await Promise.all([
    prisma.salesGoal.findMany({
      where: { year },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ month: "asc" }, { user: { name: "asc" } }],
    }),
    prisma.user.findMany({ where: { deletedAt: null, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Realizado: receita por vendedor por mês
  const realised = new Map<string, number>();
  for (const g of goals) {
    const p = ofMonth(g.year, g.month);
    const agg = await prisma.sale.aggregate({
      _sum: { netAmount: true },
      where: { sellerId: g.userId, saleDate: { gte: p.start, lt: p.end }, deletedAt: null, status: { in: ["ABERTA", "CONCLUIDA"] } },
    });
    realised.set(g.id, num(agg._sum.netAmount));
  }

  type Row = (typeof goals)[number] & { realised: number };
  const rows: Row[] = goals.map((g) => ({ ...g, realised: realised.get(g.id) ?? 0 }));

  const columns: Column<Row>[] = [
    { header: "Mês", cell: (r) => <span className="text-ink">{meses[r.month - 1]} {r.year}</span>, width: "120px" },
    { header: "Vendedor", cell: (r) => <span className="text-ink-muted">{r.user.name}</span> },
    { header: "Meta", cell: (r) => <span className="text-ink font-medium">{brl(r.targetAmount)}</span>, width: "160px", className: "text-right" },
    { header: "Realizado", cell: (r) => <span className="text-ok font-medium">{brl(r.realised)}</span>, width: "160px", className: "text-right" },
    { header: "Atingimento", cell: (r) => {
      const p = Number(r.targetAmount) > 0 ? (r.realised / Number(r.targetAmount)) * 100 : 0;
      return <span className={p >= 100 ? "text-ok" : p >= 70 ? "text-warn" : "text-danger"}>{pct(p)}</span>;
    }, width: "140px", className: "text-right" },
    { header: "", cell: (r) => <GoalActions id={r.id} userId={r.userId} year={r.year} month={r.month} targetAmount={r.targetAmount.toString()} targetSales={r.targetSales} users={users as Opt[]} />, className: "text-right", width: "100px" },
  ];

  return (
    <PageShell
      title="Metas de vendas"
      description="Definir meta mensal por vendedor. Cada vendedor vê sua meta e atingimento no dashboard."
      actions={<NewGoalButton users={users as Opt[]} year={year} />}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-muted">Ano:</span>
        {[year - 1, year, year + 1].map((y) => (
          <a key={y} href={`?year=${y}`} className={"rounded-full px-3 py-1 text-xs ring-1 " + (y === year ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-bg-elev text-ink-muted ring-line hover:text-ink")}>{y}</a>
        ))}
      </div>
      <DataTable rows={rows} columns={columns} emptyTitle="Nenhuma meta definida" emptyDescription="Crie metas mensais por vendedor para acompanhar atingimento no dashboard." />
    </PageShell>
  );
}
