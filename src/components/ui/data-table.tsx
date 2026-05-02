"use client";

import type { ReactNode } from "react";

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  className?: string;
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, unknown>[];
  maxRows?: number;
  totalRows?: number;
}

export function DataTable({ columns, rows, maxRows, totalRows }: DataTableProps) {
  const displayRows = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full border-collapse text-xs font-mono">
        <thead>
          <tr className="bg-surface">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-2.5 py-2 text-muted border-b border-border font-semibold whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/10 hover:bg-surface/50 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2.5 py-1.5 ${col.className ?? ""}`}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : (row[col.key] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {maxRows && totalRows && totalRows > maxRows && (
        <div className="text-muted text-[11px] text-center py-2">
          Showing first {maxRows} of {totalRows.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
