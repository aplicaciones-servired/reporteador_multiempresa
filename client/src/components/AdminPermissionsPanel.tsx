import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../services/HttpClient';
import { ServiceContainer } from '../services/ServiceContainer';
import type {
  AdminUserPermissionDto,
  ApiErrorDetail,
  CompanyDto,
  ReportCatalogItem,
} from '../types/api.types';
import {
  BuildingIcon,
  CheckCircleIcon,
  CloseIcon,
  RefreshIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersIcon,
  SpinnerIcon,
  UserIcon,
} from './Icons';
import StatusAlert, { type AlertVariant } from './StatusAlert';

interface AdminPermissionsPanelProps {
  readonly currentUsername: string;
  readonly onPermissionsChanged?: () => void;
}

type UserFilterMode = 'all' | 'customized' | 'active';

interface PanelAlert {
  readonly variant: AlertVariant;
  readonly message: string;
  readonly details?: ApiErrorDetail[] | string;
}

const OUTPUT_BADGE_MAP: Record<ReportCatalogItem['outputType'], { label: string; cls: string }> = {
  xlsx: { label: 'XLSX', cls: 'bg-emerald-100 text-emerald-800' },
  txt: { label: 'TXT', cls: 'bg-indigo-100 text-indigo-800' },
  table_and_xlsx: { label: 'TABLA', cls: 'bg-amber-100 text-amber-800' },
};

function haveSameElements(setValues: Set<string>, listValues: readonly string[]): boolean {
  const uniqueList = new Set(listValues);
  if (setValues.size !== uniqueList.size) {
    return false;
  }
  for (const item of setValues) {
    if (!uniqueList.has(item)) {
      return false;
    }
  }
  return true;
}

export default function AdminPermissionsPanel({
  currentUsername,
  onPermissionsChanged,
}: AdminPermissionsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [users, setUsers] = useState<AdminUserPermissionDto[]>([]);
  const [reports, setReports] = useState<ReportCatalogItem[]>([]);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);

  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilterMode>('all');
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  const [reportSearch, setReportSearch] = useState('');
  const [draftReportSlugs, setDraftReportSlugs] = useState<Set<string>>(new Set());
  const [draftCompanyCodes, setDraftCompanyCodes] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<PanelAlert | null>(null);

  const syncDraftFromUser = useCallback((target: AdminUserPermissionDto | null) => {
    if (!target) {
      setDraftReportSlugs(new Set());
      setDraftCompanyCodes(new Set());
      return;
    }
    setDraftReportSlugs(new Set(target.effectiveReportSlugs));
    setDraftCompanyCodes(new Set(target.effectiveCompanyCodes));
  }, []);

  const loadOverview = useCallback(
    async (isManualRefresh = false, preferredUsername?: string | null) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await ServiceContainer.getInstance().admin.getOverview();
        setUsers(data.users);
        setReports(data.reports);
        setCompanies(data.companies);

        const candidateName = preferredUsername ?? selectedUsername;
        const matched =
          (candidateName
            ? data.users.find(
                (u) => u.username.toLowerCase() === candidateName.toLowerCase(),
              )
            : null) ??
          data.users[0] ??
          null;

        setSelectedUsername(matched?.username ?? null);
        syncDraftFromUser(matched);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          window.location.href = '/login';
          return;
        }
        setAlert({
          variant: 'error',
          message:
            error instanceof ApiClientError
              ? error.message
              : 'No se pudo cargar la lista de usuarios de login_unificado.',
          details: error instanceof ApiClientError ? error.details : undefined,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedUsername, syncDraftFromUser],
  );

  useEffect(() => {
    void loadOverview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedUser = useMemo(
    () =>
      selectedUsername
        ? (users.find((u) => u.username.toLowerCase() === selectedUsername.toLowerCase()) ?? null)
        : null,
    [users, selectedUsername],
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userFilter === 'customized' && !u.isCustomized) {
        return false;
      }
      if (userFilter === 'active' && !u.isActive) {
        return false;
      }
      if (!q) {
        return true;
      }
      return [
        u.fullName,
        u.username,
        u.document,
        u.email,
        u.company,
        u.process,
        u.subProcess,
        u.position,
      ].some((field) => field.toLowerCase().includes(q));
    });
  }, [users, userSearch, userFilter]);

  const groupedReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    const groups = new Map<string, ReportCatalogItem[]>();

    for (const report of reports) {
      if (
        q &&
        !report.name.toLowerCase().includes(q) &&
        !report.module.toLowerCase().includes(q) &&
        !report.description.toLowerCase().includes(q)
      ) {
        continue;
      }
      const existing = groups.get(report.module) ?? [];
      existing.push(report);
      groups.set(report.module, existing);
    }

    return Array.from(groups.entries()).map(([moduleName, items]) => ({
      moduleName,
      items,
    }));
  }, [reports, reportSearch]);

  const customizedCount = useMemo(
    () => users.filter((u) => u.isCustomized).length,
    [users],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedUser) {
      return false;
    }
    return (
      !haveSameElements(draftReportSlugs, selectedUser.effectiveReportSlugs) ||
      !haveSameElements(draftCompanyCodes, selectedUser.effectiveCompanyCodes)
    );
  }, [selectedUser, draftReportSlugs, draftCompanyCodes]);

  const handleSelectUser = (user: AdminUserPermissionDto) => {
    setSelectedUsername(user.username);
    syncDraftFromUser(user);
    setAlert(null);
  };

  const toggleReportSlug = (slug: string) => {
    setDraftReportSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const toggleModuleReports = (moduleItems: readonly ReportCatalogItem[]) => {
    const allSelected = moduleItems.every((item) => draftReportSlugs.has(item.slug));
    setDraftReportSlugs((prev) => {
      const next = new Set(prev);
      for (const item of moduleItems) {
        if (allSelected) {
          next.delete(item.slug);
        } else {
          next.add(item.slug);
        }
      }
      return next;
    });
  };

  const toggleCompanyCode = (code: string) => {
    setDraftCompanyCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) {
      return;
    }
    setAlert(null);
    setSaving(true);
    try {
      await ServiceContainer.getInstance().admin.updateUserPermissions(selectedUser.username, {
        reportSlugs: Array.from(draftReportSlugs),
        companyCodes: Array.from(draftCompanyCodes),
      });
      await loadOverview(true, selectedUser.username);
      onPermissionsChanged?.();
      setAlert({
        variant: 'success',
        message: `Permisos guardados correctamente para ${selectedUser.fullName} (${selectedUser.username}).`,
      });
    } catch (error) {
      setAlert({
        variant: 'error',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'No fue posible guardar los permisos del usuario.',
        details: error instanceof ApiClientError ? error.details : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPermissions = async () => {
    if (!selectedUser) {
      return;
    }
    setAlert(null);
    setResetting(true);
    try {
      await ServiceContainer.getInstance().admin.resetUserPermissions(selectedUser.username);
      await loadOverview(true, selectedUser.username);
      onPermissionsChanged?.();
      setAlert({
        variant: 'info',
        message: `Se restauraron los permisos por defecto para ${selectedUser.fullName} (${selectedUser.username}).`,
      });
    } catch (error) {
      setAlert({
        variant: 'error',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'No fue posible restaurar los permisos del usuario.',
      });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center shadow-xs">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#15469B]">
          <SpinnerIcon className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Cargando usuarios de login_unificado...
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Obteniendo procesos, cargos y permisos asignados
        </p>
      </section>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Cabecera del módulo Admin */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="brand-ribbon h-1 w-full" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#15469B] ring-1 ring-blue-200/70">
              <SlidersIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  Administración de Permisos por Usuario
                </h1>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#15469B] ring-1 ring-blue-200/70">
                  login_unificado
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Configura qué reportes y empresas puede ver cada usuario. Solo visible para
                Desarrollo Informático y Director de Tecnología.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <span className="text-slate-500">Usuarios:</span>{' '}
              <strong className="font-bold tabular-nums text-slate-900">{users.length}</strong>
            </div>
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 px-3 py-1.5 text-xs">
              <span className="text-[#15469B]">Personalizados:</span>{' '}
              <strong className="font-bold tabular-nums text-[#15469B]">
                {customizedCount}
              </strong>
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void loadOverview(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? (
                <SpinnerIcon className="h-3.5 w-3.5" />
              ) : (
                <RefreshIcon className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>{refreshing ? 'Actualizando...' : 'Recargar'}</span>
            </button>
          </div>
        </div>
      </section>

      {alert && (
        <StatusAlert
          variant={alert.variant}
          message={alert.message}
          details={alert.details}
          onDismiss={() => setAlert(null)}
        />
      )}

      {/* Maestro - Detalle */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Lista de usuarios */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs lg:col-span-5">
          <div className="border-b border-slate-100 p-4">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <SearchIcon className="h-4 w-4" />
              </span>
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre, usuario, cédula, proceso o cargo..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50/40 py-2 pr-8 pl-9 text-xs text-slate-900 placeholder-slate-400 outline-hidden transition focus:border-[#15469B] focus:bg-white focus:ring-4 focus:ring-[#15469B]/10"
              />
              {userSearch.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setUserSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-700"
                  aria-label="Limpiar búsqueda de usuarios"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'customized', label: 'Personalizados' },
                  { id: 'active', label: 'Activos' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setUserFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    userFilter === tab.id
                      ? 'bg-[#15469B] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="custom-scrollbar max-h-[65vh] flex-1 divide-y divide-slate-100 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No se encontraron usuarios con el filtro actual.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected =
                  selectedUser?.username.toLowerCase() === u.username.toLowerCase();
                const isSelf = u.username.toLowerCase() === currentUsername.toLowerCase();

                return (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition ${
                      isSelected
                        ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-200'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            u.isActive ? 'bg-emerald-500' : 'bg-rose-400'
                          }`}
                          title={u.state}
                        />
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {u.fullName}
                        </p>
                        {isSelf && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            Tú
                          </span>
                        )}
                        {u.isAdminPortalAuthorized && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            Admin
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                        {u.username}
                        {u.document ? ` · CC ${u.document}` : ''}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-slate-600">
                        {[u.process, u.position || u.subProcess, u.company]
                          .filter(Boolean)
                          .join(' · ') || 'Sin proceso/cargo registrado'}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.isCustomized
                            ? 'bg-blue-100 text-[#15469B]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.isCustomized ? 'Personalizado' : 'Por defecto'}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-500">
                        {u.effectiveReportSlugs.length} rep.
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Editor de permisos del usuario seleccionado */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs lg:col-span-7">
          {!selectedUser ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <UserIcon className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Selecciona un usuario de la lista
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Podrás habilitar o restringir sus empresas y reportes individuales.
              </p>
            </div>
          ) : (
            <>
              {/* Ficha del usuario */}
              <div className="border-b border-slate-100 bg-slate-50/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedUser.fullName}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          selectedUser.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {selectedUser.state}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">
                        {selectedUser.username}
                      </span>
                      {selectedUser.email ? ` · ${selectedUser.email}` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                      <ShieldCheckIcon className="h-3.5 w-3.5 text-[#15469B]" />
                      Rol base: {selectedUser.defaultRoleCode}
                    </span>
                    {selectedUser.updatedAt && (
                      <p className="mt-1 text-[10px] text-slate-400">
                        Actualizado por {selectedUser.updatedBy}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Proceso</p>
                    <p className="truncate font-semibold text-slate-800">
                      {selectedUser.process || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Cargo</p>
                    <p className="truncate font-semibold text-slate-800">
                      {selectedUser.position || selectedUser.subProcess || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Empresa</p>
                    <p className="truncate font-semibold text-slate-800">
                      {selectedUser.company || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido editable */}
              <div className="custom-scrollbar max-h-[55vh] flex-1 space-y-5 overflow-y-auto p-5">
                {/* Empresas */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-700 uppercase">
                      <BuildingIcon className="h-3.5 w-3.5 text-slate-500" />
                      Empresas Autorizadas
                    </p>
                    <span className="text-[11px] font-medium text-slate-500">
                      {draftCompanyCodes.size} seleccionadas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {companies.map((c) => {
                      const checked = draftCompanyCodes.has(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => toggleCompanyCode(c.code)}
                          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
                            checked
                              ? 'border-[#15469B] bg-blue-50/70 ring-2 ring-[#15469B]/15'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{c.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {c.cityLabel} · {c.code}
                            </p>
                          </div>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                              checked
                                ? 'border-[#15469B] bg-[#15469B] text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reportes */}
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold tracking-wide text-slate-700 uppercase">
                        Reportes Autorizados
                      </p>
                      <p className="text-[11px] text-slate-500">
                        <strong className="tabular-nums text-slate-800">
                          {draftReportSlugs.size}
                        </strong>{' '}
                        de {reports.length} reportes seleccionados
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDraftReportSlugs(new Set(reports.map((r) => r.slug)))}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftReportSlugs(new Set())}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Quitar todos
                      </button>
                    </div>
                  </div>

                  <div className="relative mb-3">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <SearchIcon className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="search"
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder="Filtrar reportes por nombre o módulo..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-8 pl-8.5 text-xs text-slate-900 outline-hidden focus:border-[#15469B] focus:ring-4 focus:ring-[#15469B]/10"
                    />
                    {reportSearch.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setReportSearch('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-700"
                        aria-label="Limpiar filtro de reportes"
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {groupedReports.map(({ moduleName, items }) => {
                      const selectedInModule = items.filter((r) =>
                        draftReportSlugs.has(r.slug),
                      ).length;
                      const allInModule = selectedInModule === items.length;

                      return (
                        <div
                          key={moduleName}
                          className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5"
                        >
                          <div className="mb-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                                {moduleName}
                              </h3>
                              <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                                {selectedInModule}/{items.length}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleModuleReports(items)}
                              className="text-[11px] font-semibold text-[#15469B] hover:underline"
                            >
                              {allInModule ? 'Desmarcar módulo' : 'Marcar módulo'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {items.map((rep) => {
                              const checked = draftReportSlugs.has(rep.slug);
                              const badge = OUTPUT_BADGE_MAP[rep.outputType];

                              return (
                                <label
                                  key={rep.slug}
                                  title={rep.description}
                                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                                    checked
                                      ? 'border-blue-300 bg-white shadow-xs ring-1 ring-blue-200/60'
                                      : 'border-slate-200/80 bg-white/70 opacity-80 hover:opacity-100'
                                  }`}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleReportSlug(rep.slug)}
                                      className="h-4 w-4 rounded border-slate-300 text-[#15469B] focus:ring-[#15469B]"
                                    />
                                    <span className="truncate font-medium text-slate-800">
                                      {rep.name}
                                    </span>
                                  </span>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}
                                  >
                                    {badge.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Barra inferior de guardado */}
              <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs">
                  {hasUnsavedChanges ? (
                    <span className="font-semibold text-amber-700">
                      Hay cambios sin guardar para este usuario
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {selectedUser.isCustomized
                        ? 'Usando configuración personalizada'
                        : 'Usando permisos heredados por defecto'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={!selectedUser.isCustomized || saving || resetting}
                    onClick={() => void handleResetPermissions()}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {resetting ? 'Restaurando...' : 'Restaurar por defecto'}
                  </button>

                  <button
                    type="button"
                    disabled={saving || resetting}
                    onClick={() => void handleSavePermissions()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0F2C67] to-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-[#0C2454] hover:to-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving && <SpinnerIcon className="h-3.5 w-3.5" />}
                    <span>{saving ? 'Guardando...' : 'Guardar permisos'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
