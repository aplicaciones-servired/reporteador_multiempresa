import { useMemo, useState, type ComponentType } from 'react';
import type { CatalogModuleGroup, ReportCatalogItem } from '../types/api.types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  SearchIcon,
  TableIcon,
  type IconProps,
} from './Icons';

interface SidebarProps {
  readonly modules: CatalogModuleGroup[];
  readonly selectedSlug: string | null;
  readonly mobileOpen: boolean;
  readonly onCloseMobile: () => void;
  readonly onSelectReport: (report: ReportCatalogItem) => void;
}

const OUTPUT_META: Record<
  ReportCatalogItem['outputType'],
  { label: string; cls: string; activeCls: string; Icon: ComponentType<IconProps> }
> = {
  xlsx: {
    label: 'XLSX',
    cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20',
    activeCls: 'bg-white/20 text-white ring-1 ring-white/25',
    Icon: FileSpreadsheetIcon,
  },
  txt: {
    label: 'TXT',
    cls: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20',
    activeCls: 'bg-white/20 text-white ring-1 ring-white/25',
    Icon: FileTextIcon,
  },
  table_and_xlsx: {
    label: 'TABLA',
    cls: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20',
    activeCls: 'bg-white/20 text-white ring-1 ring-white/25',
    Icon: TableIcon,
  },
};

export default function Sidebar({
  modules,
  selectedSlug,
  mobileOpen,
  onCloseMobile,
  onSelectReport,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  const totalReports = useMemo(
    () => modules.reduce((acc, group) => acc + group.reports.length, 0),
    [modules],
  );

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return modules;
    }
    return modules
      .map((group) => ({
        ...group,
        reports: group.reports.filter(
          (rep) =>
            rep.name.toLowerCase().includes(query) ||
            rep.module.toLowerCase().includes(query) ||
            rep.description.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.reports.length > 0);
  }, [modules, search]);

  const filteredCount = useMemo(
    () => filteredModules.reduce((acc, group) => acc + group.reports.length, 0),
    [filteredModules],
  );

  const isSearching = search.trim().length > 0;

  const toggleModule = (moduleName: string) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  const content = (
    <div className="flex h-full flex-col bg-[#0B172E] text-slate-100">
      <div className="brand-ribbon h-1 w-full shrink-0" />

      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/img/1055644.png"
              alt="Reporteador Multiempresa"
              className="h-9 w-9 shrink-0 rounded-xl bg-white/10 p-1 object-contain ring-1 ring-white/15"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-white">Reporteador</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-blue-200 ring-1 ring-white/10">
                  {totalReports}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                Catálogo Multiempresa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú lateral"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-3.5">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <SearchIcon className="h-3.5 w-3.5" />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar reporte o módulo..."
            className="w-full rounded-xl border border-white/10 bg-[#122344] py-2 pr-8 pl-8.5 text-xs text-white placeholder-slate-400 outline-hidden transition focus:border-blue-400/60 focus:bg-[#15294F] focus:ring-2 focus:ring-blue-500/25"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 transition hover:text-white"
              aria-label="Limpiar búsqueda"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isSearching && (
          <p className="mt-2 px-0.5 text-[11px] text-slate-400">
            {filteredCount === 1
              ? '1 reporte encontrado'
              : `${filteredCount} reportes encontrados`}
          </p>
        )}
      </div>

      <nav className="custom-scrollbar-dark flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {filteredModules.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-5 text-center">
            <p className="text-xs font-medium text-slate-300">Sin coincidencias</p>
            <p className="mt-1 text-[11px] text-slate-400">
              No se encontraron reportes para "{search}".
            </p>
          </div>
        )}

        {filteredModules.map((group) => {
          const isCollapsed = !isSearching && Boolean(collapsedModules[group.module]);
          return (
            <div key={group.module} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleModule(group.module)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
                aria-expanded={!isCollapsed}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {isCollapsed ? (
                    <ChevronRightIcon className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  <span className="truncate">{group.module}</span>
                </span>
                <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
                  {group.reports.length}
                </span>
              </button>

              {!isCollapsed && (
                <ul className="space-y-1">
                  {group.reports.map((report) => {
                    const isSelected = report.slug === selectedSlug;
                    const meta = OUTPUT_META[report.outputType];
                    const OutputIcon = meta.Icon;

                    return (
                      <li key={report.slug}>
                        <button
                          type="button"
                          title={report.description}
                          onClick={() => {
                            onSelectReport(report);
                            onCloseMobile();
                          }}
                          className={`group flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                            isSelected
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-white shadow-md shadow-blue-950/40'
                              : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <OutputIcon
                              className={`h-3.5 w-3.5 shrink-0 ${
                                isSelected
                                  ? 'text-blue-100'
                                  : 'text-slate-400 group-hover:text-slate-200'
                              }`}
                            />
                            <span className="truncate">{report.name}</span>
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                              isSelected ? meta.activeCls : meta.cls
                            }`}
                          >
                            {meta.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            XLSX
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            TXT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            TABLA
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-slate-800/80 lg:block">
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 h-full w-72 max-w-[85vw] shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
