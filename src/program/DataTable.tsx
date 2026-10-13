"use client";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

export type { ColumnDef };

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  caption: string;
  footer?: (string | number | null)[]; // one cell per column, e.g. totals from the source
  empty?: string;
  testId?: string;
  initialSort?: SortingState;
}

/** Sortable on every column. Nulls always sort last. */
export function DataTable<T>({ data, columns, caption, footer, empty = "אין נתונים להצגה", testId, initialSort = [] }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    sortDescFirst: false, // first click is always ascending, for numbers and text alike
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    defaultColumn: { sortUndefined: "last" },
  });

  return (
    <div className="table-wrap" data-testid={testId}>
      <table className="table ptable">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const dir = h.column.getIsSorted();
                return (
                  <th key={h.id} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} scope="col">
                    {h.isPlaceholder ? null : (
                      <button type="button" className="sort-btn" onClick={h.column.getToggleSortingHandler()} data-sort={dir || "none"}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <span className="sort-mark">{dir === "asc" ? "עולה" : dir === "desc" ? "יורד" : ""}</span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="muted" data-testid="table-empty">{empty}</td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, i) =>
                i === 0 ? (
                  <th key={cell.id} scope="row" className="row-h">{flexRender(cell.column.columnDef.cell, cell.getContext())}</th>
                ) : (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {footer.map((f, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="row-h">{f ?? ""}</th>
                ) : (
                  <td key={i} className="num">{f ?? ""}</td>
                ),
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
