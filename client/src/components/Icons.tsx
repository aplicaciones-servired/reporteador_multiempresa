import type { ReactNode } from 'react';

export interface IconProps {
  readonly className?: string;
}

function SvgIcon({
  className = 'h-4 w-4',
  children,
}: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </SvgIcon>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </SvgIcon>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </SvgIcon>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </SvgIcon>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </SvgIcon>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </SvgIcon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </SvgIcon>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </SvgIcon>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </SvgIcon>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </SvgIcon>
  );
}

export function HashIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </SvgIcon>
  );
}

export function TicketIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </SvgIcon>
  );
}

export function FileSpreadsheetIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M8 13h2" />
      <path d="M14 13h2" />
      <path d="M8 17h2" />
      <path d="M14 17h2" />
    </SvgIcon>
  );
}

export function FileTextIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </SvgIcon>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 3v18" />
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </SvgIcon>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </SvgIcon>
  );
}

export function DatabaseIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </SvgIcon>
  );
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </SvgIcon>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </SvgIcon>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </SvgIcon>
  );
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </SvgIcon>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </SvgIcon>
  );
}

export function AlertCircleIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </SvgIcon>
  );
}

export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </SvgIcon>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </SvgIcon>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m2 12 8.58 3.91a2 2 0 0 0 1.66 0L20.82 12" />
      <path d="m2 17 8.58 3.91a2 2 0 0 0 1.66 0L20.82 17" />
    </SvgIcon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </SvgIcon>
  );
}

export function SpinnerIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
        className="opacity-85"
      />
    </svg>
  );
}

export function SortAscIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
      <path d="M11 12h4" />
      <path d="M11 16h7" />
      <path d="M11 20h10" />
    </SvgIcon>
  );
}

export function SortDescIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="M11 4h10" />
      <path d="M11 8h7" />
      <path d="M11 12h4" />
    </SvgIcon>
  );
}

export function SortNeutralIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </SvgIcon>
  );
}

export function FilterIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </SvgIcon>
  );
}
