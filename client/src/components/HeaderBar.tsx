import type { PublicUserProfile, ReportCatalogItem } from '../types/api.types';
import { ChevronRightIcon, LogOutIcon, MenuIcon, SpinnerIcon } from './Icons';

interface HeaderBarProps {
  readonly user: PublicUserProfile;
  readonly activeReport?: ReportCatalogItem | null;
  readonly onToggleMobileMenu: () => void;
  readonly onLogout: () => void;
  readonly loggingOut: boolean;
}

function getInitials(fullName: string, login: string): string {
  const source = fullName.trim() || login.trim();
  if (!source) {
    return 'U';
  }
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getCompanyDotClass(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('MULTIRED')) {
    return 'bg-[#15469B]';
  }
  if (upper.includes('SERVIRED')) {
    return 'bg-[#EC681C]';
  }
  return 'bg-emerald-500';
}

export default function HeaderBar({
  user,
  activeReport,
  onToggleMobileMenu,
  onLogout,
  loggingOut,
}: HeaderBarProps) {
  const initials = getInitials(user.fullName, user.login);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 lg:hidden"
          aria-label="Abrir menú de reportes"
        >
          <MenuIcon className="h-4 w-4 text-slate-600" />
          <span>Menú</span>
        </button>

        <div className="hidden items-center gap-3 sm:flex">
          <img
            src="/img/multired4.png"
            alt="Multired"
            className="h-7 w-auto object-contain"
          />
          <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <img
            src="/img/servired.png"
            alt="ServiRed"
            className="h-7 w-auto object-contain"
          />
        </div>

        {activeReport && (
          <div className="hidden min-w-0 items-center gap-1.5 border-l border-slate-200 pl-3 text-xs xl:flex">
            <span className="shrink-0 font-medium text-slate-400">
              {activeReport.module}
            </span>
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            <span className="truncate font-semibold text-slate-700">
              {activeReport.name}
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden flex-wrap items-center gap-1.5 md:flex">
          {user.companies.map((c) => (
            <span
              key={c.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
            >
              <span className={`h-2 w-2 rounded-full ${getCompanyDotClass(c.name)}`} />
              <span>{c.name}</span>
              <span className="text-slate-400">({c.code})</span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-l border-slate-200/80 pl-3">
          <div
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F2C67] to-[#1D4ED8] text-xs font-bold text-white shadow-xs sm:flex"
            aria-hidden="true"
          >
            {initials}
          </div>

          <div className="text-right">
            <p className="max-w-[160px] truncate text-sm font-semibold text-slate-900 sm:max-w-none">
              {user.fullName}
            </p>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
              <span>{user.login}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                {user.roleCode}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={loggingOut}
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut ? (
            <SpinnerIcon className="h-3.5 w-3.5" />
          ) : (
            <LogOutIcon className="h-3.5 w-3.5" />
          )}
          <span>{loggingOut ? 'Saliendo...' : 'Salir'}</span>
        </button>
      </div>
    </header>
  );
}
