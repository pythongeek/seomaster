'use client';

import { type ReactNode } from 'react';

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

// ─── MetricCard ─────────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
}) {
  const trendPositive = trend !== undefined && trend > 0;
  const trendNeutral = trend === undefined || trend === 0;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <span className="block text-sm text-gray-500">{label}</span>
      <span className="block text-2xl font-semibold text-gray-900">{value}</span>
      {sub && <span className="block text-xs text-gray-400">{sub}</span>}
      {!trendNeutral && trend !== undefined && (
        <span className={`mt-1 block text-xs font-medium ${trendPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trendPositive ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: string }) {
  const classes: Record<string, string> = {
    default: 'bg-gray-100 text-gray-700',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    success: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[variant] || classes.default}`}>
      {children}
    </span>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  small,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  small?: boolean;
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
  };
  const size = small ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <button
      className={`${base} ${variants[variant]} ${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.817 3 8.218l2-2.927z" />
    </svg>
  );
}

// ─── EmptyState ─────────────────────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <span className="text-3xl">◎</span>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

// ─── SearchInput ────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

// ─── SectionHeader ──────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Table ──────────────────────────────────────────────────────────────────

export function Table({
  columns,
  rows,
  onRowClick,
}: {
  columns: Array<{
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    render?: (val: unknown, row: Record<string, unknown>) => ReactNode;
  }>;
  rows: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-sm text-gray-900 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────

export function Pagination({
  current,
  total,
  totalItems,
  onPage,
}: {
  current: number;
  total: number;
  totalItems: number;
  onPage: (page: number) => void;
}) {
  if (total <= 1) return null;
  const PAGE_SIZE = 50;
  const from = (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <span className="text-sm text-gray-500">
        Showing {from}–{to} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
          onClick={() => onPage(current - 1)}
          disabled={current === 1}
        >
          Prev
        </button>
        <span className="text-sm text-gray-600">
          Page {current} of {total}
        </span>
        <button
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
          onClick={() => onPage(current + 1)}
          disabled={current === total}
        >
          Next
        </button>
      </div>
    </div>
  );
}