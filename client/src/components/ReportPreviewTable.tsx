import { useEffect, useMemo, useState } from 'react';
import type { ColumnFormat, ReportPreviewResponse } from '../types/api.types';
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
  SortNeutralIcon,
  SpinnerIcon,
  TableIcon,
} from './Icons';

interface ReportPreviewTableProps {
  readonly preview: ReportPreviewResponse | null;
  readonly loading: boolean;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  readonly key: string;
  readonly direction: SortDirection;
  readonly format?: ColumnFormat;
}

type DensityMode = 'comfortable' | 'compact';
type PageSizeOption = 25 | 50 | 100 | 'all';

const numberFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCellValue(
  value: string | number | null | undefined,
  format?: ColumnFormat,
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (format === 'currency' || format === 'number') {
    const num = toFiniteNumber(value);
    if (num !== null) {
      if (format === 'currency') {
        return `${num < 0 ? '-' : ''}$ ${numberFormatter.format(Math.abs(num))}`;
      }
      return numberFormatter.format(num);
    }
  }
  return String(value);
}

function formatGeneratedTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }
  return date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

export default function ReportPreviewTable({
  preview,
  loading,
}: ReportPreviewTableProps) {
  const [tableFilter, setTableFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [pageSize, setPageSize] = useState<PageSizeOption>(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setTableFilter('');
    setSortConfig(null);
    setCurrentPage(1);
  }, [preview]);

  const filteredRows = useMemo(() => {
    if (!preview) {
      return [];
    }
    const q = tableFilter.trim().toLowerCase();
    if (!q) {
      return preview.rows;
    }
    return preview.rows.filter((row) =>
      preview.columns.some((col) =>
        String(row[col.key] ?? '').toLowerCase().includes(q),
      ),
    );
  }, [preview, tableFilter]);

  const sortedRows = useMemo(() => {
    if (!sortConfig) {
      return filteredRows;
    }
    const { key, direction, format } = sortConfig;
    const isNumeric = format === 'number' || format === 'currency';
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      const emptyA = isEmptyCell(valA);
      const emptyB = isEmptyCell(valB);

      if (emptyA && emptyB) return 0;
      if (emptyA) return 1;
      if (emptyB) return -1;

      if (isNumeric) {
        const numA = toFiniteNumber(valA);
        const numB = toFiniteNumber(valB);
        if (numA !== null && numB !== null) {
          return (numA - numB) * multiplier;
        }
      }

      return String(valA).localeCompare(String(valB), 'es', { numeric: true }) * multiplier;
    });
  }, [filteredRows, sortConfig]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all' || sortedRows.length === 0) {
      return 1;
    }
    return Math.ceil(sortedRows.length / pageSize);
  }, [sortedRows.length, pageSize]);

  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') {
      return sortedRows;
    }
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, pageSize, safePage]);

  const rowOffset = pageSize === 'all' ? 0 : (safePage - 1) * pageSize;
  const visibleStart = sortedRows.length === 0 ? 0 : rowOffset + 1;
  const visibleEnd = rowOffset + paginatedRows.length;

  const handleToggleSort = (key: string, format?: ColumnFormat) => {
    setCurrentPage(1);
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc', format };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc', format };
      }
      return null;
    });
  };

  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="space-y-2">
            <div className="h-4 w-52 animate-pulse rounded-md bg-slate-200" />
            <div className="h-3 w-36 animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-[#15469B] ring-1 ring-blue-200/70">
            <SpinnerIcon className="h-3.5 w-3.5" />
            <span>Consultando información en Oracle...</span>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="grid grid-cols-6 gap-3 rounded-xl bg-slate-900/90 px-4 py-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-3 animate-pulse rounded bg-white/20" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid grid-cols-6 gap-3 rounded-xl border border-slate-100 px-4 py-3"
            >
              {Array.from({ length: 6 }).map((__, colIdx) => (
                <div
                  key={colIdx}
                  className="h-3 animate-pulse rounded bg-slate-100"
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!preview) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300/90 bg-white/80 p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <TableIcon className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-sm font-bold text-slate-900">
          Sin vista previa cargada
        </h2>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          Configura los filtros arriba y presiona{' '}
          <strong className="font-semibold text-slate-700">Previsualizar en tabla</strong> o{' '}
          <strong className="font-semibold text-slate-700">Descargar</strong> para generar el
          reporte.
        </p>
      </section>
    );
  }

  const cellPaddingClass = density === 'compact' ? 'px-3 py-1.5' : 'px-3.5 py-2.5';

  return (
    <section className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      {/* Barra superior de resultados */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Resultados: {preview.reportName}
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[#15469B] ring-1 ring-blue-200/70">
              {filteredRows.length} / {preview.totalReturned} filas
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <ClockIcon className="h-3 w-3 text-slate-400" />
              <span>{formatGeneratedTime(preview.generatedAt)}</span>
            </span>
          </div>

          {preview.truncated && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200/70">
              <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>
                Vista previa limitada a 500 registros; usa Descargar para obtener el total
                completo.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <SearchIcon className="h-3.5 w-3.5" />
            </span>
            <input
              type="search"
              value={tableFilter}
              onChange={(e) => {
                setTableFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filtrar en los resultados..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-8 pl-8.5 text-xs text-slate-900 outline-hidden transition focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
            />
            {tableFilter.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTableFilter('');
                  setCurrentPage(1);
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-700"
                aria-label="Limpiar filtro de tabla"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Densidad de filas"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5"
          >
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                density === 'comfortable'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cómoda
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                density === 'compact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Compacta
            </button>
          </div>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No hay registros para mostrar
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tableFilter.trim()
              ? `Ninguna fila coincide con "${tableFilter}".`
              : 'La consulta no arrojó resultados para los parámetros seleccionados.'}
          </p>
        </div>
      ) : (
        <>
          <div className="custom-scrollbar max-h-[60vh] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#0B172E] text-white">
                <tr>
                  <th
                    scope="col"
                    className="w-12 px-3 py-3 text-center font-semibold tracking-wider text-slate-400"
                  >
                    #
                  </th>
                  {preview.columns.map((col) => {
                    const isSorted = sortConfig?.key === col.key;
                    const sortDir = isSorted ? sortConfig.direction : null;
                    const isNumeric =
                      col.format === 'number' || col.format === 'currency';

                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className="px-3.5 py-3 font-semibold whitespace-nowrap"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSort(col.key, col.format)}
                          className={`group inline-flex w-full items-center gap-1.5 text-left transition hover:text-blue-200 ${
                            isNumeric ? 'justify-end' : 'justify-between'
                          }`}
                        >
                          <span>{col.header}</span>
                          {sortDir === 'asc' ? (
                            <SortAscIcon className="h-3.5 w-3.5 shrink-0 text-blue-300" />
                          ) : sortDir === 'desc' ? (
                            <SortDescIcon className="h-3.5 w-3.5 shrink-0 text-blue-300" />
                          ) : (
                            <SortNeutralIcon className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-60 transition group-hover:text-slate-300 group-hover:opacity-100" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRows.map((row, rowIndex) => (
                  <tr
                    key={rowOffset + rowIndex}
                    className="transition-colors even:bg-slate-50/70 hover:bg-blue-50/50"
                  >
                    <td className="px-3 py-2 text-center font-mono text-[11px] tabular-nums text-slate-400">
                      {rowOffset + rowIndex + 1}
                    </td>
                    {preview.columns.map((col) => {
                      const isNumeric =
                        col.format === 'number' || col.format === 'currency';
                      return (
                        <td
                          key={col.key}
                          className={`${cellPaddingClass} whitespace-nowrap text-slate-700 ${
                            isNumeric ? 'text-right font-mono tabular-nums font-medium text-slate-900' : ''
                          }`}
                        >
                          {formatCellValue(row[col.key], col.format)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Barra inferior de paginación */}
          <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Mostrando{' '}
                <strong className="font-semibold tabular-nums text-slate-900">
                  {visibleStart}–{visibleEnd}
                </strong>{' '}
                de{' '}
                <strong className="font-semibold tabular-nums text-slate-900">
                  {sortedRows.length}
                </strong>{' '}
                registros
              </span>

              <div className="flex items-center gap-1.5">
                <label htmlFor="preview-page-size" className="text-slate-500">
                  Filas:
                </label>
                <select
                  id="preview-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPageSize(val === 'all' ? 'all' : (Number(val) as 25 | 50 | 100));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-hidden focus:border-[#15469B]"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">Todas</option>
                </select>
              </div>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
                  <span>Anterior</span>
                </button>
                <span className="px-1.5 font-medium tabular-nums text-slate-700">
                  Página {safePage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span>Siguiente</span>
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
