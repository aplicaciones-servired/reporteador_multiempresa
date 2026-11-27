import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiClientError } from '../services/HttpClient';
import { ServiceContainer } from '../services/ServiceContainer';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BuildingIcon,
  EyeIcon,
  EyeOffIcon,
  FileSpreadsheetIcon,
  LockIcon,
  ShieldCheckIcon,
  SpinnerIcon,
  UserIcon,
} from './Icons';
import StatusAlert from './StatusAlert';

const SHOWCASE_FEATURES = [
  {
    title: 'Operación Multiempresa',
    description: 'Consolidación en tiempo real para Yumbo (39627) y Jamundí (39628).',
    Icon: BuildingIcon,
    accent: 'text-sky-300 bg-sky-400/15 ring-sky-400/20',
  },
  {
    title: 'Exportación Instantánea',
    description: 'Vistas previas filtrables, libros Excel .xlsx y planos SISBET .txt.',
    Icon: FileSpreadsheetIcon,
    accent: 'text-emerald-300 bg-emerald-400/15 ring-emerald-400/20',
  },
  {
    title: 'Seguridad por Perfiles',
    description: 'Acceso corporativo autenticado con control granular de módulos y empresas.',
    Icon: ShieldCheckIcon,
    accent: 'text-amber-300 bg-amber-400/15 ring-amber-400/20',
  },
] as const;

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePasswordKeyState = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Por favor ingresa usuario y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await ServiceContainer.getInstance().auth.login(username.trim(), password);
      window.location.href = '/';
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('No fue posible iniciar sesión. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F6FA] lg:grid lg:grid-cols-12">
      {/* Panel izquierdo corporativo */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#07142B] via-[#0E244D] to-[#091834] text-white lg:col-span-7 lg:flex lg:flex-col lg:justify-between">
        <div className="brand-ribbon h-1.5 w-full shrink-0" />
        <div className="bg-login-grid pointer-events-none absolute inset-0 opacity-75" />
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-12 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 py-12 xl:px-16">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-blue-100 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Plataforma Corporativa de Reportes
          </div>

          <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-white xl:text-[2.6rem] xl:leading-[1.15]">
            Inteligencia operativa unificada para Multired y ServiRed
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
            Consulta información consolidada desde Oracle en tiempo real, aplica filtros por
            empresa o fecha y genera archivos listos para auditoría y gestión comercial.
          </p>

          <div className="mt-10 grid max-w-2xl gap-4">
            {SHOWCASE_FEATURES.map(({ title, description, Icon, accent }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.09]"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accent}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 px-12 py-5 text-xs text-slate-400 xl:px-16">
          <span>Grupo Yumundi · Plataforma unificada de reportes</span>
          <span className="font-medium text-slate-300">Portal Multiempresa</span>
        </div>
      </section>

      {/* Panel derecho de autenticación */}
      <section className="relative flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8 lg:col-span-5 lg:px-10 xl:px-14">
        <div className="brand-ribbon fixed inset-x-0 top-0 h-1.5 lg:hidden" />

        <div className="animate-fade-in-up mx-auto w-full max-w-md">
          {/* Tarjeta principal de acceso */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/5">
            <div className="brand-ribbon h-1 w-full" />

            <div className="p-7 sm:p-8">
              {/* Logos corporativos sobre fondo blanco nítido */}
              <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-xs">
                <img
                  src="/img/multired4.png"
                  alt="Grupo Empresarial Multired"
                  className="h-10 w-auto object-contain sm:h-11"
                />
                <span className="h-8 w-px bg-slate-200" aria-hidden="true" />
                <img
                  src="/img/servired.png"
                  alt="Grupo Empresarial ServiRed"
                  className="h-10 w-auto object-contain sm:h-11"
                />
              </div>

              <div className="mb-6">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#15469B] uppercase ring-1 ring-blue-200/70">
                  Reporteador Multiempresa
                </span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  Bienvenido
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ingresa con tus credenciales corporativas para consultar reportes.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5">
                  <StatusAlert
                    variant="error"
                    message={errorMsg}
                    onDismiss={() => setErrorMsg(null)}
                  />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-user"
                    className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
                  >
                    Usuario
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <input
                      id="login-user"
                      type="text"
                      autoFocus
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej. admin"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/40 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:bg-white focus:ring-4 focus:ring-[#15469B]/10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-700 uppercase"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <LockIcon className="h-4 w-4" />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handlePasswordKeyState}
                      onKeyDown={handlePasswordKeyState}
                      placeholder="Ingresa tu contraseña"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/40 py-2.5 pr-11 pl-10 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition hover:border-slate-400 focus:border-[#15469B] focus:bg-white focus:ring-4 focus:ring-[#15469B]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-700"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {capsLockOn && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <AlertTriangleIcon className="h-3.5 w-3.5" />
                      Bloq Mayús está activado
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F2C67] to-[#1D4ED8] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-950/15 transition hover:from-[#0C2454] hover:to-[#1E40AF] focus:ring-4 focus:ring-blue-600/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <SpinnerIcon className="h-4 w-4" />
                      <span>Validando acceso...</span>
                    </>
                  ) : (
                    <>
                      <span>Ingresar al sistema</span>
                      <ArrowRightIcon className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                <span>Sesión corporativa cifrada y validada</span>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400 lg:hidden">
            Grupo Yumundi · Plataforma unificada de reportes
          </p>
        </div>
      </section>
    </main>
  );
}
