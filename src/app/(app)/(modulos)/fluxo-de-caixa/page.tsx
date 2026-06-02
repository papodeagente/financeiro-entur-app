import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { brl } from "@/lib/format";
import { lastNMonths, nextNMonths, currentPeriod, monthShortLabel } from "@/lib/period";
import { syncOverdueInstallments, syncOverdueExpenses } from "@/lib/finance-ops";
import { DualAreaChart, type AreaPoint } from "@/components/charts/area-chart";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const num = (d: { toString: () => string } | number | null | undefined) =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : parseFloat(d.toString());

async function loadFlow() {
  await Promise.all([syncOverdueInstallments(), syncOverdueExpenses()]);
  const past = lastNMonths(6).slice(0, -1); // 5 meses antes do atual
  const next = nextNMonths(4); // mês atual + próximos 3
  const months = [...past, ...next];

  const initialCash = num((await prisma.bankAccount.aggregate({ _sum: { currentBalance: true }, where: { active: true, deletedAt: null } }))._sum.currentBalance);

  // Realizado dos meses passados (entradas/saídas com base em BankTransactions)
  const rows = await Promise.all(months.map(async (m) => {
    const [entradasReal, saidasReal, entradasPrev, saidasPrev] = await Promise.all([
      prisma.bankTransaction.aggregate({
        _sum: { amount: true },
        where: { occurredAt: { gte: m.start, lt: m.end }, direction: "CREDITO" },
      }),
      prisma.bankTransaction.aggregate({
        _sum: { amount: true },
        where: { occurredAt: { gte: m.start, lt: m.end }, direction: "DEBITO" },
      }),
      prisma.revenueInstallment.aggregate({
        _sum: { amount: true, paidAmount: true },
        where: { deletedAt: null, dueDate: { gte: m.start, lt: m.end }, status: { in: ["PENDENTE", "PARCIALMENTE_PAGO", "VENCIDO", "EM_NEGOCIACAO"] } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { deletedAt: null, dueDate: { gte: m.start, lt: m.end }, status: { in: ["PENDENTE", "VENCIDO", "AGENDADO"] } },
      }),
    ]);
    return {
      m,
      entradasReal: num(entradasReal._sum.amount),
      saidasReal: num(saidasReal._sum.amount),
      entradasPrev: num(entradasPrev._sum.amount) - num(entradasPrev._sum.paidAmount),
      saidasPrev: num(saidasPrev._sum.amount),
    };
  }));

  // Saldo cumulativo: saldo no fim do mês atual = saldo em caixa.
  // Reconstrução pra trás: subtrai entradas-saidas dos meses futuros.
  // Reconstrução pra frente: soma deltas (realizado + previsto).
  const now = new Date();
  const currIdx = rows.findIndex((r) => r.m.start.getMonth() === now.getMonth() && r.m.start.getFullYear() === now.getFullYear());

  const balances = new Array(rows.length).fill(0);
  if (currIdx >= 0) {
    balances[currIdx] = initialCash;
    for (let i = currIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      balances[i] = balances[i - 1] + r.entradasPrev - r.saidasPrev;
    }
    for (let i = currIdx - 1; i >= 0; i--) {
      const next = rows[i + 1];
      balances[i] = balances[i + 1] - (next.entradasReal - next.saidasReal);
    }
  }

  return { rows: rows.map((r, i) => ({ ...r, saldo: balances[i] })), currIdx, initialCash };
}

export default async function Page() {
  const { rows, currIdx, initialCash } = await loadFlow();
  const period = currentPeriod("mes");

  const currentRow = rows[currIdx];
  const next3 = rows.slice(currIdx + 1, currIdx + 4);

  // Gráfico: saldo vs entradas-saidas dos próximos meses
  const seriesRealizado: AreaPoint[] = rows.slice(0, currIdx + 1).map((r) => ({ label: monthShortLabel(r.m.month ?? 1), value: r.entradasReal - r.saidasReal }));
  const seriesProjetado: AreaPoint[] = rows.slice(currIdx).map((r) => ({ label: monthShortLabel(r.m.month ?? 1), value: r.entradasPrev - r.saidasPrev }));

  // Próximos 30/60/90 dias
  const accProj30 = next3[0] ? next3[0].entradasPrev - next3[0].saidasPrev : 0;
  const accProj60 = accProj30 + (next3[1] ? next3[1].entradasPrev - next3[1].saidasPrev : 0);
  const accProj90 = accProj60 + (next3[2] ? next3[2].entradasPrev - next3[2].saidasPrev : 0);

  const negativeAhead = rows.slice(currIdx).some((r) => r.saldo < 0);

  return (
    <PageShell
      title="Fluxo de caixa"
      description={`Realizado (até ${period.label}) e projetado (próximos 3 meses).`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Saldo atual em caixa" value={brl(initialCash)} />
        <Kpi label="Projeção em 30 dias" value={brl(initialCash + accProj30)} tone={initialCash + accProj30 < 0 ? "danger" : undefined} />
        <Kpi label="Projeção em 60 dias" value={brl(initialCash + accProj60)} tone={initialCash + accProj60 < 0 ? "danger" : undefined} />
        <Kpi label="Projeção em 90 dias" value={brl(initialCash + accProj90)} tone={initialCash + accProj90 < 0 ? "danger" : undefined} />
      </div>

      {negativeAhead && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Caixa negativo previsto. Reescalone vencimentos, antecipe recebíveis ou ajuste contas a pagar.
        </div>
      )}

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink">Movimento mensal</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Realizado nos meses passados, previsto a partir do mês atual.</p>
        <div className="mt-4">
          <DualAreaChart
            series={[
              { label: "Realizado", color: "#22C55E", data: seriesRealizado },
              { label: "Previsto", color: "#A855F7", data: seriesProjetado },
            ]}
            height={180}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="text-right">Entradas (real.)</th>
              <th className="text-right">Saídas (real.)</th>
              <th className="text-right">Entradas (prev.)</th>
              <th className="text-right">Saídas (prev.)</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isCurrent = i === currIdx;
              const isFuture = i > currIdx;
              return (
                <tr key={r.m.label} className={isCurrent ? "bg-brand-soft/20" : ""}>
                  <td className="text-ink">
                    {r.m.label} {isCurrent && <span className="ml-2 badge-info">hoje</span>}
                  </td>
                  <td className="text-right text-ok">{isFuture ? "—" : brl(r.entradasReal)}</td>
                  <td className="text-right text-warn">{isFuture ? "—" : brl(r.saidasReal)}</td>
                  <td className="text-right text-info">{brl(r.entradasPrev)}</td>
                  <td className="text-right text-danger">{brl(r.saidasPrev)}</td>
                  <td className={"text-right font-medium " + (r.saldo < 0 ? "text-danger" : "text-ink")}>{brl(r.saldo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-subtle">
        ⓘ <strong>Realizado</strong>: movimentações registradas nas contas (BankTransaction) — derivam de pagamentos e recebimentos efetivos.
        <strong> Previsto</strong>: contas a receber e a pagar pelo vencimento, ainda em aberto.
        Não inclui novas vendas que ainda não foram cadastradas.
      </p>
    </PageShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className={"mt-2 text-2xl font-semibold " + (tone === "danger" ? "text-danger" : "text-ink")}>{value}</p>
    </div>
  );
}
