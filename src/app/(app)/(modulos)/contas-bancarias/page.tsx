import { prisma } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { NewButton, RowActions, type BankAccountRow } from "./_components/form";
import { brl } from "@/lib/format";
import { bankAccountTypeLabel } from "@/lib/validations";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const where = {
    deletedAt: null,
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { bank: { contains: q, mode: "insensitive" as const } },
    ]} : {}),
  };
  const list = await prisma.bankAccount.findMany({ where, orderBy: { name: "asc" } });
  const totalBalance = list.filter(a => a.active).reduce((acc, a) => acc + Number(a.currentBalance), 0);

  const rows: BankAccountRow[] = list.map((a) => ({
    id: a.id, name: a.name, type: a.type,
    bank: a.bank, agency: a.agency, accountNumber: a.accountNumber,
    openingBalance: a.openingBalance.toString(), currentBalance: a.currentBalance.toString(),
    notes: a.notes, active: a.active,
  }));

  const columns: Column<BankAccountRow>[] = [
    {
      header: "Conta",
      cell: (r) => (
        <div>
          <div className={"font-medium " + (r.active ? "text-ink" : "text-ink-subtle line-through")}>{r.name}</div>
          {r.bank && <div className="text-xs text-ink-subtle mt-0.5">{r.bank}{r.agency && ` · ag ${r.agency}`}{r.accountNumber && ` · cc ${r.accountNumber}`}</div>}
        </div>
      ),
    },
    { header: "Tipo", cell: (r) => <span className="badge-muted">{bankAccountTypeLabel[r.type]}</span>, width: "160px" },
    { header: "Saldo atual", cell: (r) => <span className="font-medium text-ink">{brl(r.currentBalance)}</span>, width: "160px", className: "text-right" },
    { header: "Status", cell: (r) => r.active ? <span className="badge-ok">Ativa</span> : <span className="badge-muted">Inativa</span>, width: "100px" },
    { header: "", cell: (r) => <RowActions row={r} />, className: "text-right", width: "120px" },
  ];

  return (
    <PageShell
      title="Contas bancárias"
      description="Contas correntes, poupanças, gateways, cartões e caixa interno."
      actions={<NewButton />}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput placeholder="Buscar conta ou banco…" />
        <div className="text-sm text-ink-muted">Saldo total: <span className="text-ink font-medium">{brl(totalBalance)}</span></div>
      </div>
      <DataTable rows={rows} columns={columns} emptyTitle="Nenhuma conta cadastrada" />
    </PageShell>
  );
}
