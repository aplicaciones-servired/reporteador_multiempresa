import { useEffect, useMemo, useState } from 'react';
import type {
  CompanyDto,
  ReportCatalogItem,
  ReportFilterPayload,
} from '../types/api.types';
import {
  AlertCircleIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardIcon,
  DatabaseIcon,
  DownloadIcon,
  EyeIcon,
  HashIcon,
  InfoIcon,
  PlusIcon,
  SpinnerIcon,
  TicketIcon,
  TrashIcon,
} from './Icons';

interface ReportFilterPanelProps {
  readonly report: ReportCatalogItem;
  readonly companies: CompanyDto[];
  readonly busyAction: 'preview' | 'export' | null;
  readonly onPreview: (payload: ReportFilterPayload) => void;
  readonly onExport: (payload: ReportFilterPayload) => void;
}

type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'month';

const ORACLE_SOURCE_STYLE: Record<
  ReportCatalogItem['oracleSource'],
  { label: string; dot: string; badge: string }
> = {
  principal: {
    label: 'Oracle Principal',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200/70',
  },
  replica: {
    label: 'Oracle Réplica',
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  },
  naos: {
    label: 'Oracle NAOS',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  },
};

const OUTPUT_TYPE_LABEL: Record<ReportCatalogItem['outputType'], string> = {
  xlsx: 'Excel (.xlsx)',
  txt: 'Plano SISBET (.txt)',
  table_and_xlsx: 'Tabla + Excel (.xlsx)',
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeDatePreset(preset: DateRangePreset): { fecha1: string; fecha2: string } {
  const today = new Date();
  if (preset === 'today') {
    const formatted = toIsoDate(today);
    return { fecha1: formatted, fecha2: formatted };
  }

  const end = new Date(today);
  end.setDate(end.getDate() - 1);

  const start = new Date(end);
  if (preset === 'last7') {
    start.setDate(end.getDate() - 6);
  } else if (preset === 'last30') {
    start.setDate(end.getDate() - 29);
  } else if (preset === 'month') {
    start.setDate(1);
  }

  return { fecha1: toIsoDate(start), fecha2: toIsoDate(end) };
}

function getCompanyBrandStyle(name: string): {
  activeCard: string;
  activeDot: string;
  activeSub: string;
} {
  const upper = name.toUpperCase();
  if (upper.includes('SERVIRED')) {
    return {
      activeCard: 'border-[#EC681C] bg-orange-50/60 ring-2 ring-[#EC681C]/15',
      activeDot: 'bg-[#EC681C]',
      activeSub: 'text-orange-700',
    };
  }
  return {
    activeCard: 'border-[#15469B] bg-blue-50/60 ring-2 ring-[#15469B]/15',
    activeDot: 'bg-[#15469B]',
    activeSub: 'text-[#15469B]',
  };
}

function parseDocumentsText(raw: string): string[] {
  const extracted = raw
    .split(/[\s,;]+/)
    .map((token) => token.replace(/\D+/g, '').trim())
    .filter((token) => token.length > 0);
  return Array.from(new Set(extracted));
}

export default function ReportFilterPanel({
  report,
  companies,
  busyAction,
  onPreview,
  onExport,
}: ReportFilterPanelProps) {
  const defaults = computeDatePreset('yesterday');
  const [empresa, setEmpresa] = useState<string>('');
  const [fecha1, setFecha1] = useState<string>(defaults.fecha1);
  const [fecha2, setFecha2] = useState<string>(defaults.fecha2);
  const [sorteo, setSorteo] = useState<string>('');
  const [serie, setSerie] = useState<string>('');
  const [documentInputs, setDocumentInputs] = useState<string[]>(['']);
  const [bulkText, setBulkText] = useState<string>('');
  const [showBulkBox, setShowBulkBox] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(null);
    if (report.requiresCompany) {
      setEmpresa((prev) => {
        if (prev && companies.some((c) => c.code === prev)) {
          return prev;
        }
        return companies.length === 1 ? companies[0].code : (companies[0]?.code ?? '');
      });
    } else if (report.inputSchema === 'document_list') {
      setEmpresa('');
    }
  }, [report.slug, report.requiresCompany, report.inputSchema, companies]);

  const validDocumentsCount = useMemo(
    () =>
      new Set(documentInputs.map((d) => d.trim()).filter((d) => d.length > 0)).size,
    [documentInputs],
  );

  const bulkParsedDocuments = useMemo(() => parseDocumentsText(bulkText), [bulkText]);

  const applyRangePreset = (preset: DateRangePreset) => {
    const range = computeDatePreset(preset);
    setFecha1(range.fecha1);
    setFecha2(range.fecha2);
  };

  const applySingleDatePreset = (preset: 'today' | 'yesterday') => {
    const range = computeDatePreset(preset);
    setFecha1(range.fecha1);
  };

  const isRangePresetActive = (preset: DateRangePreset): boolean => {
    const range = computeDatePreset(preset);
    return fecha1 === range.fecha1 && fecha2 === range.fecha2;
  };

  const isSinglePresetActive = (preset: 'today' | 'yesterday'): boolean => {
    const range = computeDatePreset(preset);
    return fecha1 === range.fecha1;
  };

  const handleDocumentChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D+/g, '');
    setDocumentInputs((prev) => prev.map((item, i) => (i === index ? digitsOnly : item)));
  };

  const handleAddDocumentRow = () => {
    setDocumentInputs((prev) => [...prev, '']);
  };

  const handleRemoveDocumentRow = (index: number) => {
    setDocumentInputs((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  };

  const handleClearDocuments = () => {
    setDocumentInputs(['']);
    setBulkText('');
  };

  const handleApplyBulkPaste = () => {
    if (bulkParsedDocuments.length > 0) {
      setDocumentInputs(bulkParsedDocuments);
      setBulkText('');
      setShowBulkBox(false);
    }
  };

  const buildValidatedPayload = (): ReportFilterPayload | null => {
    setLocalError(null);

    if (report.requiresCompany && !empresa) {
      setLocalError('Debes seleccionar una empresa.');
      return null;
    }

    if (report.inputSchema === 'date_range') {
      if (!fecha1 || !fecha2) {
        setLocalError('Debes indicar fecha inicial y fecha final.');
        return null;
      }
      if (fecha1 > fecha2) {
        setLocalError('La fecha inicial no puede ser mayor que la fecha final.');
        return null;
      }
      return {
        ...(report.requiresCompany ? { empresa } : {}),
        fecha1,
        fecha2,
      };
    }

    if (report.inputSchema === 'single_date') {
      if (!fecha1) {
        setLocalError('Debes indicar la fecha del reporte.');
        return null;
      }
      return { empresa, fecha1 };
    }

    if (report.inputSchema === 'single_date_sorteo') {
      if (!fecha1) {
        setLocalError('Debes indicar la fecha del reporte.');
        return null;
      }
      if (!/^\d{4}$/.test(sorteo.trim())) {
        setLocalError('El sorteo debe tener exactamente 4 dígitos numéricos.');
        return null;
      }
      return { empresa, fecha1, sorteo: sorteo.trim() };
    }

    if (report.inputSchema === 'single_date_serie') {
      if (!fecha1) {
        setLocalError('Debes indicar la fecha desde la cual consultar.');
        return null;
      }
      const cleanSerie = serie.trim().toUpperCase();
      if (!cleanSerie || !/^[A-Za-z0-9-]+$/.test(cleanSerie)) {
        setLocalError('La serie es obligatoria y solo puede contener letras, números o guiones.');
        return null;
      }
      return { fecha1, serie: cleanSerie };
    }

    if (report.inputSchema === 'document_list') {
      const cleaned = Array.from(
        new Set(documentInputs.map((d) => d.trim()).filter((d) => d.length > 0)),
      );
      if (cleaned.length === 0) {
        setLocalError('Debes ingresar al menos un número de documento.');
        return null;
      }
      return {
        ...(empresa ? { empresa } : {}),
        documentos: cleaned,
      };
    }

    return { empresa };
  };

  const showCompanySelector =
    report.requiresCompany || report.inputSchema === 'document_list';
  const useSegmentedCompanyCards =
    report.requiresCompany && companies.length > 0 && companies.length <= 2;
  const showDate1 =
    report.inputSchema === 'date_range' ||
    report.inputSchema === 'single_date' ||
    report.inputSchema === 'single_date_sorteo' ||
    report.inputSchema === 'single_date_serie';
  const showDate2 = report.inputSchema === 'date_range';
  const showSingleDatePresets =
    report.inputSchema === 'single_date' || report.inputSchema === 'single_date_sorteo';
  const showSorteo = report.inputSchema === 'single_date_sorteo';
  const showSerie = report.inputSchema === 'single_date_serie';
  const showDocuments = report.inputSchema === 'document_list';

  const sourceStyle = ORACLE_SOURCE_STYLE[report.oracleSource];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      {/* Cabecera del reporte */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#15469B] ring-1 ring-blue-200/70">
                {report.module}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ${sourceStyle.badge}`}
              >
                <DatabaseIcon className="h-3 w-3" />
                <span className={`h-1.5 w-1.5 rounded-full ${sourceStyle.dot}`} />
                {sourceStyle.label}
              </span>
              <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {OUTPUT_TYPE_LABEL[report.outputType]}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {report.name}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
              {report.description}
            </p>
          </div>

          {showDate2 && (
            <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
              {(
                [
                  { id: 'today', label: 'Hoy' },
                  { id: 'yesterday', label: 'Ayer' },
                  { id: 'last7', label: 'Últimos 7 días' },
                  { id: 'last30', label: 'Últimos 30 días' },
                  { id: 'month', label: 'Mes actual' },
                ] as const
              ).map((preset) => {
                const active = isRangePresetActive(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyRangePreset(preset.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-[#15469B] text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}

          {showSingleDatePresets && (
            <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
              {(
                [
                  { id: 'today', label: 'Hoy' },
                  { id: 'yesterday', label: 'Ayer' },
                ] as const
              ).map((preset) => {
                const active = isSinglePresetActive(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applySingleDatePreset(preset.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-[#15469B] text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cuerpo de filtros */}
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {showCompanySelector && (
            <div className={useSegmentedCompanyCards ? 'sm:col-span-2' : ''}>
              <label
                htmlFor={useSegmentedCompanyCards ? undefined : 'filter-company'}
                className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
              >
                Empresa {report.requiresCompany ? '*' : '(Opcional)'}
              </label>

              {useSegmentedCompanyCards ? (
                <div
                  role="radiogroup"
                  aria-label="Seleccionar empresa"
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                >
                  {companies.map((c) => {
                    const isSelected = empresa === c.code;
                    const brand = getCompanyBrandStyle(c.name);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setEmpresa(c.code)}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                          isSelected
                            ? brand.activeCard
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                isSelected ? brand.activeDot : 'bg-slate-300'
                              }`}
                            />
                            <span className="truncate text-sm font-bold text-slate-900">
                              {c.name}
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 truncate pl-4.5 text-[11px] font-medium ${
                              isSelected ? brand.activeSub : 'text-slate-500'
                            }`}
                          >
                            {c.cityLabel} · Cód. {c.code}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200/80">
                          {c.nit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <BuildingIcon className="h-4 w-4" />
                  </span>
                  <select
                    id="filter-company"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
                  >
                    {!report.requiresCompany && (
                      <option value="">Todas las autorizadas</option>
                    )}
                    {report.requiresCompany && companies.length === 0 && (
                      <option value="">Sin empresas asignadas</option>
                    )}
                    {companies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code} - {c.cityLabel})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {showDate1 && (
            <div>
              <label
                htmlFor="filter-fecha1"
                className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
              >
                {showDate2 ? 'Fecha Inicial *' : showSerie ? 'Fecha desde *' : 'Fecha *'}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <CalendarIcon className="h-4 w-4" />
                </span>
                <input
                  id="filter-fecha1"
                  type="date"
                  value={fecha1}
                  onChange={(e) => setFecha1(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
                />
              </div>
            </div>
          )}

          {showDate2 && (
            <div>
              <label
                htmlFor="filter-fecha2"
                className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
              >
                Fecha Final *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <CalendarIcon className="h-4 w-4" />
                </span>
                <input
                  id="filter-fecha2"
                  type="date"
                  value={fecha2}
                  onChange={(e) => setFecha2(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
                />
              </div>
            </div>
          )}

          {showSorteo && (
            <div>
              <label
                htmlFor="filter-sorteo"
                className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
              >
                Sorteo (4 dígitos) *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <HashIcon className="h-4 w-4" />
                </span>
                <input
                  id="filter-sorteo"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={sorteo}
                  onChange={(e) => setSorteo(e.target.value.replace(/\D+/g, '').slice(0, 4))}
                  placeholder="Ej. 4520"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 font-mono text-sm text-slate-900 outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
                />
              </div>
            </div>
          )}

          {showSerie && (
            <div>
              <label
                htmlFor="filter-serie"
                className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
              >
                Serie y Número *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <TicketIcon className="h-4 w-4" />
                </span>
                <input
                  id="filter-serie"
                  type="text"
                  maxLength={40}
                  value={serie}
                  onChange={(e) => setSerie(e.target.value.toUpperCase())}
                  placeholder="Ej. G1S0004806296"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 font-mono text-sm text-slate-900 uppercase outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
                />
              </div>
            </div>
          )}
        </div>

        {showDocuments && (
          <div className="mt-5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold tracking-wide text-slate-700 uppercase">
                    Números de Documento / Cédula *
                  </p>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#15469B]">
                    {validDocumentsCount}{' '}
                    {validDocumentsCount === 1 ? 'válido' : 'válidos'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Agrega documentos manualmente o pega una lista separada por comas o saltos de línea.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {validDocumentsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearDocuments}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>Limpiar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowBulkBox((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    showBulkBox
                      ? 'border-blue-300 bg-blue-50 text-[#15469B]'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                  <span>{showBulkBox ? 'Ocultar pegado masivo' : 'Pegado masivo'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddDocumentRow}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>Agregar documento</span>
                </button>
              </div>
            </div>

            {showBulkBox && (
              <div className="animate-fade-in mb-4 space-y-2.5 rounded-xl border border-blue-200/80 bg-white p-3.5 shadow-xs">
                <textarea
                  rows={3}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Pega aquí las cédulas separadas por salto de línea, espacio o coma..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-mono text-xs text-slate-900 outline-hidden focus:border-[#15469B] focus:ring-2 focus:ring-[#15469B]/10"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Detectados:{' '}
                    <strong className="tabular-nums text-slate-800">
                      {bulkParsedDocuments.length}
                    </strong>{' '}
                    documentos únicos
                  </span>
                  <button
                    type="button"
                    disabled={bulkParsedDocuments.length === 0}
                    onClick={handleApplyBulkPaste}
                    className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cargar documentos
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {documentInputs.map((docValue, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 font-mono text-[10px] font-bold text-slate-400">
                      #{index + 1}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={docValue}
                      onChange={(e) => handleDocumentChange(index, e.target.value)}
                      placeholder="Número de cédula"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 font-mono text-sm text-slate-900 outline-hidden transition focus:border-[#15469B] focus:ring-2 focus:ring-[#15469B]/10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDocumentRow(index)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    title="Eliminar fila"
                    aria-label={`Eliminar documento #${index + 1}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {localError && (
          <div
            role="alert"
            className="animate-fade-in mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800"
          >
            <AlertCircleIcon className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{localError}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <InfoIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span>Vista previa hasta 500 filas · La descarga exporta el total completo</span>
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                const payload = buildValidatedPayload();
                if (payload) {
                  onPreview(payload);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'preview' ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span>Consultando...</span>
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4 text-slate-500" />
                  <span>Previsualizar en tabla</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => {
                const payload = buildValidatedPayload();
                if (payload) {
                  onExport(payload);
                }
              }}
              className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                report.outputType === 'txt'
                  ? 'from-indigo-600 to-blue-600 shadow-indigo-950/15 hover:from-indigo-700 hover:to-blue-700'
                  : 'from-emerald-600 to-teal-600 shadow-emerald-950/15 hover:from-emerald-700 hover:to-teal-700'
              }`}
            >
              {busyAction === 'export' ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span>Generando archivo...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="h-4 w-4" />
                  <span>
                    {report.outputType === 'txt'
                      ? 'Descargar plano (.txt)'
                      : 'Descargar Excel (.xlsx)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
