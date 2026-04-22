import type { ReactElement } from 'react';
import type { DeviceType } from '@gp16/shared';

export function PvIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="2" y="8" width="36" height="24" rx="3" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.2" />
      <line x1="2" y1="16" x2="38" y2="16" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5" />
      <line x1="2" y1="24" x2="38" y2="24" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5" />
      <line x1="14" y1="8" x2="14" y2="32" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5" />
      <line x1="26" y1="8" x2="26" y2="32" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5" />
      {/* Reflection highlight */}
      <rect x="4" y="10" width="10" height="5" rx="1" fill="white" opacity="0.08" />
      {/* Sun indicator */}
      <circle cx="35" cy="4" r="3.5" fill="#fbbf24" opacity="0.9" />
      <line x1="35" y1="0" x2="35" y2="1" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <line x1="39" y1="1" x2="38" y2="1.8" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function InverterIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="3" y="6" width="34" height="28" rx="4" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.2" />
      {/* DC label */}
      <text x="20" y="17" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="700" fontFamily="Inter, sans-serif">DC</text>
      {/* Divider */}
      <line x1="8" y1="21" x2="32" y2="21" stroke="#3b82f6" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
      {/* AC wave */}
      <text x="20" y="30" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="700" fontFamily="Inter, sans-serif">AC</text>
      {/* Status LED */}
      <circle cx="8" cy="10" r="2" fill="#22c55e" opacity="0.8" />
    </svg>
  );
}

export function BatteryIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Battery body */}
      <rect x="2" y="10" width="32" height="20" rx="3" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1.2" />
      {/* Terminal */}
      <rect x="34" y="16" width="4" height="8" rx="1.5" fill="#22c55e" opacity="0.7" />
      {/* Charge cells */}
      <rect x="5" y="13" width="5.5" height="14" rx="1.5" fill="#22c55e" opacity="0.85" />
      <rect x="12" y="13" width="5.5" height="14" rx="1.5" fill="#22c55e" opacity="0.6" />
      <rect x="19" y="13" width="5.5" height="14" rx="1.5" fill="#22c55e" opacity="0.35" />
      {/* Lightning bolt */}
      <path d="M27 15 L24.5 20 H26.5 L24 25 L28 19 H26 Z" fill="#22c55e" opacity="0.7" />
    </svg>
  );
}

export function ChargerIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Charger body */}
      <rect x="9" y="3" width="22" height="34" rx="5" fill="#fdf2f8" stroke="#ec4899" strokeWidth="1.2" />
      {/* Cable top */}
      <line x1="14" y1="3" x2="14" y2="8" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="3" x2="26" y2="8" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
      {/* Lightning bolt */}
      <path d="M22 16 L18 23 H21 L18.5 29 L23 22 H20 Z" fill="#ec4899" opacity="0.8" />
      {/* Status indicator */}
      <circle cx="20" cy="32" r="2.5" fill="#ec4899" opacity="0.4" />
    </svg>
  );
}

export function LoadIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Building base */}
      <rect x="6" y="16" width="28" height="21" rx="2" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="1.2" />
      {/* Roof */}
      <polygon points="20,4 4,17 36,17" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Windows */}
      <rect x="11" y="21" width="6" height="5" rx="0.8" fill="#8b5cf6" opacity="0.25" />
      <rect x="23" y="21" width="6" height="5" rx="0.8" fill="#8b5cf6" opacity="0.25" />
      {/* Door */}
      <rect x="17" y="28" width="6" height="9" rx="1" fill="#8b5cf6" opacity="0.35" />
    </svg>
  );
}

export function GridIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Central transmission tower */}
      <line x1="20" y1="4" x2="20" y2="36" stroke="#f97316" strokeWidth="1.5" />
      {/* Cross beams */}
      <line x1="8" y1="10" x2="32" y2="10" stroke="#f97316" strokeWidth="1.5" />
      <line x1="12" y1="20" x2="28" y2="20" stroke="#f97316" strokeWidth="1.2" />
      <line x1="16" y1="30" x2="24" y2="30" stroke="#f97316" strokeWidth="1" />
      {/* Support lines */}
      <line x1="8" y1="10" x2="20" y2="36" stroke="#f97316" strokeWidth="0.8" opacity="0.5" />
      <line x1="32" y1="10" x2="20" y2="36" stroke="#f97316" strokeWidth="0.8" opacity="0.5" />
      {/* Node dots */}
      <circle cx="8" cy="10" r="2.5" fill="#f97316" opacity="0.8" />
      <circle cx="32" cy="10" r="2.5" fill="#f97316" opacity="0.8" />
      <circle cx="12" cy="20" r="1.8" fill="#f97316" opacity="0.6" />
      <circle cx="28" cy="20" r="1.8" fill="#f97316" opacity="0.6" />
      <circle cx="20" cy="4" r="2" fill="#f97316" opacity="0.7" />
    </svg>
  );
}

export const DEVICE_ICON: Record<DeviceType, (props: { size?: number }) => ReactElement> = {
  pv_panel: PvIcon,
  inverter: InverterIcon,
  battery: BatteryIcon,
  charger: ChargerIcon,
  load: LoadIcon,
  grid: GridIcon,
};
