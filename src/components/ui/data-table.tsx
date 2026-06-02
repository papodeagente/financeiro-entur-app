import type { ReactNode } from "react";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  width?: string;
};

export function DataTable<T extends { id: string }>({
  rows, columns, emptyTitle = "Nenhum registro encontrado", emptyDescription,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-base font-medium text-ink">{emptyTitle}</p>
        {emptyDescription && <p className="text-sm text-ink-muted mt-1">{emptyDescription}</p>}
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={c.className} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c, i) => (
                <td key={i} className={c.className}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
