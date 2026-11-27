import type { ComponentType } from 'react';
import type { ApiErrorDetail } from '../types/api.types';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoIcon,
  type IconProps,
} from './Icons';

export type AlertVariant = 'error' | 'success' | 'info' | 'warning';

interface StatusAlertProps {
  readonly variant: AlertVariant;
  readonly message: string;
  readonly details?: ApiErrorDetail[] | string;
  readonly onDismiss?: () => void;
}

interface VariantStyle {
  readonly container: string;
  readonly iconWrap: string;
  readonly Icon: ComponentType<IconProps>;
}

const VARIANT_STYLES: Record<AlertVariant, VariantStyle> = {
  error: {
    container: 'border-rose-200/90 border-l-rose-600 bg-rose-50/90 text-rose-950',
    iconWrap: 'bg-rose-100 text-rose-700',
    Icon: AlertCircleIcon,
  },
  success: {
    container: 'border-emerald-200/90 border-l-emerald-600 bg-emerald-50/90 text-emerald-950',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircleIcon,
  },
  info: {
    container: 'border-sky-200/90 border-l-sky-600 bg-sky-50/90 text-sky-950',
    iconWrap: 'bg-sky-100 text-sky-700',
    Icon: InfoIcon,
  },
  warning: {
    container: 'border-amber-200/90 border-l-amber-500 bg-amber-50/90 text-amber-950',
    iconWrap: 'bg-amber-100 text-amber-700',
    Icon: AlertTriangleIcon,
  },
};

export default function StatusAlert({
  variant,
  message,
  details,
  onDismiss,
}: StatusAlertProps) {
  const style = VARIANT_STYLES[variant];
  const VariantIcon = style.Icon;

  return (
    <div
      role="alert"
      className={`animate-fade-in rounded-xl border border-l-4 px-4 py-3.5 text-sm shadow-xs ${style.container}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.iconWrap}`}
          >
            <VariantIcon className="h-4 w-4" />
          </span>

          <div className="space-y-1">
            <p className="font-semibold leading-snug">{message}</p>
            {typeof details === 'string' && details.trim().length > 0 && (
              <p className="text-xs leading-relaxed opacity-90">{details}</p>
            )}
            {Array.isArray(details) && details.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs opacity-90">
                {details.map((item, idx) => (
                  <li key={`${item.path}-${idx}`}>
                    {item.path ? <span className="font-semibold">{item.path}: </span> : null}
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-65 transition hover:bg-black/5 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
