import { useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../services/HttpClient';
import { ServiceContainer } from '../services/ServiceContainer';
import type {
  ApiErrorDetail,
  CatalogModuleGroup,
  CompanyDto,
  PublicUserProfile,
  ReportCatalogItem,
  ReportFilterPayload,
  ReportPreviewResponse,
} from '../types/api.types';
import HeaderBar from './HeaderBar';
import {
  ArrowRightIcon,
  BuildingIcon,
  LayersIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from './Icons';
import ReportFilterPanel from './ReportFilterPanel';
import ReportPreviewTable from './ReportPreviewTable';
import Sidebar from './Sidebar';
import StatusAlert, { type AlertVariant } from './StatusAlert';

interface AlertState {
  readonly variant: AlertVariant;
  readonly message: string;
  readonly details?: ApiErrorDetail[] | string;
}

export default function DashboardApp() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [modules, setModules] = useState<CatalogModuleGroup[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportCatalogItem | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [busyAction, setBusyAction] = useState<'preview' | 'export' | null>(null);
  const [preview, setPreview] = useState<ReportPreviewResponse | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const totalReports = useMemo(
    () => modules.reduce((acc, group) => acc + group.reports.length, 0),
    [modules],
  );

  useEffect(() => {
    let active = true;
    const services = ServiceContainer.getInstance();

    async function bootstrap() {
      try {
        const [profile, catalog] = await Promise.all([
          services.auth.getCurrentUser(),
          services.catalog.getCatalog(),
        ]);
        if (!active) {
          return;
        }
        setUser(profile);
        setCompanies(catalog.companies);
        setModules(catalog.modules);

        const firstReport = catalog.modules[0]?.reports[0] ?? null;
        setSelectedReport(firstReport);
      } catch (error) {
        if (!active) {
          return;
        }
        if (error instanceof ApiClientError && error.status === 401) {
          window.location.href = '/login';
          return;
        }
        setAlert({
          variant: 'error',
          message:
            error instanceof ApiClientError
              ? error.message
              : 'No se pudo cargar el catálogo del reporteador.',
        });
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectReport = (report: ReportCatalogItem) => {
    setSelectedReport(report);
    setPreview(null);
    setAlert(null);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await ServiceContainer.getInstance().auth.logout();
    } finally {
      window.location.href = '/login';
    }
  };

  const handlePreview = async (payload: ReportFilterPayload) => {
    if (!selectedReport) {
      return;
    }
    setAlert(null);
    setBusyAction('preview');
    try {
      const response = await ServiceContainer.getInstance().reports.preview(
        selectedReport.slug,
        payload,
      );
      setPreview(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          window.location.href = '/login';
          return;
        }
        setAlert({
          variant: 'error',
          message: error.message,
          details: error.details,
        });
      } else {
        setAlert({
          variant: 'error',
          message: 'Error al consultar la vista previa del reporte.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleExport = async (payload: ReportFilterPayload) => {
    if (!selectedReport) {
      return;
    }
    setAlert(null);
    setBusyAction('export');
    try {
      const filename = await ServiceContainer.getInstance().reports.exportAndDownload(
        selectedReport.slug,
        payload,
      );
      setAlert({
        variant: 'success',
        message: `Archivo descargado correctamente: ${filename}`,
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          window.location.href = '/login';
          return;
        }
        setAlert({
          variant: 'error',
          message: error.message,
          details: error.details,
        });
      } else {
        setAlert({
          variant: 'error',
          message: 'Error al generar el archivo de exportación.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] px-4">
        <div className="animate-fade-in-up w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/5">
          <div className="brand-ribbon h-1.5 w-full" />
          <div className="p-8 text-center">
            <div className="mx-auto mb-6 flex items-center justify-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3">
              <img src="/img/multired4.png" alt="Multired" className="h-8 w-auto object-contain" />
              <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
              <img src="/img/servired.png" alt="ServiRed" className="h-8 w-auto object-contain" />
            </div>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#15469B]">
              <SpinnerIcon className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-800">
              Cargando sesión y catálogo de reportes...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Verificando permisos por perfil y empresas habilitadas
            </p>

            <div className="mt-6 space-y-2.5">
              <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto h-2.5 w-3/4 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] px-4">
        <div className="animate-fade-in-up w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/5">
          <div className="brand-ribbon h-1.5 w-full" />
          <div className="space-y-5 p-7 sm:p-8">
            <div className="flex items-center justify-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-3 shadow-xs">
              <img src="/img/multired4.png" alt="Multired" className="h-9 w-auto object-contain" />
              <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
              <img src="/img/servired.png" alt="ServiRed" className="h-9 w-auto object-contain" />
            </div>

            <StatusAlert
              variant="error"
              message={alert?.message ?? 'No fue posible inicializar la sesión.'}
              details={alert?.details}
            />

            <div className="text-center">
              <a
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F2C67] to-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-950/15 transition hover:from-[#0C2454] hover:to-[#1E40AF]"
              >
                <span>Ir al inicio de sesión</span>
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const companyCitySummary =
    companies.length > 0
      ? companies.map((c) => c.cityLabel).join(' · ')
      : 'Sin empresas habilitadas';

  return (
    <div className="flex min-h-screen bg-[#F4F6FA]">
      <Sidebar
        modules={modules}
        selectedSlug={selectedReport?.slug ?? null}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectReport={handleSelectReport}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          user={user}
          activeReport={selectedReport}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={() => void handleLogout()}
          loggingOut={loggingOut}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-4 sm:p-6">
          {/* Resumen ejecutivo de sesión y permisos */}
          <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#15469B] ring-1 ring-blue-100">
                <LayersIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Reportes Autorizados
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  <span className="tabular-nums">{totalReports}</span> en{' '}
                  <span className="tabular-nums">{modules.length}</span>{' '}
                  {modules.length === 1 ? 'módulo' : 'módulos'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <BuildingIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Empresas Habilitadas
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                  {companies.length > 0 ? (
                    <>
                      <span className="tabular-nums">{companies.length}</span> ({companyCitySummary})
                    </>
                  ) : (
                    'Ninguna asignada'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Perfil Activo
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                  {user.roleName}
                </p>
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

          {selectedReport ? (
            <>
              <ReportFilterPanel
                report={selectedReport}
                companies={companies}
                busyAction={busyAction}
                onPreview={(payload) => void handlePreview(payload)}
                onExport={(payload) => void handleExport(payload)}
              />
              <ReportPreviewTable
                preview={preview}
                loading={busyAction === 'preview'}
              />
            </>
          ) : (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <ShieldCheckIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                Sin reportes asignados
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tu perfil (<span className="font-semibold text-slate-700">{user.roleCode}</span>) no
                tiene reportes habilitados actualmente. Contacta a soporte de aplicaciones si
                requieres acceso.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
