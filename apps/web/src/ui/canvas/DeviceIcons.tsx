import type { ReactElement } from 'react';
import type { DeviceType } from '@gp16/shared';

export function PvIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="2" y="9" width="36" height="24" rx="2" fill="#1a1a2e" stroke="#faad14" strokeWidth="1.5"/>
      <line x1="2" y1="17" x2="38" y2="17" stroke="#faad14" strokeWidth="0.7" opacity="0.55"/>
      <line x1="2" y1="25" x2="38" y2="25" stroke="#faad14" strokeWidth="0.7" opacity="0.55"/>
      <line x1="14" y1="9" x2="14" y2="33" stroke="#faad14" strokeWidth="0.7" opacity="0.55"/>
      <line x1="26" y1="9" x2="26" y2="33" stroke="#faad14" strokeWidth="0.7" opacity="0.55"/>
      <circle cx="35" cy="5" r="4" fill="#faad14"/>
      <line x1="35" y1="0" x2="35" y2="1.5" stroke="#faad14" strokeWidth="1.3"/>
      <line x1="39.5" y1="1.5" x2="38.4" y2="2.6" stroke="#faad14" strokeWidth="1.3"/>
      <line x1="40" y1="5" x2="38.5" y2="5" stroke="#faad14" strokeWidth="1.3"/>
    </svg>
  );
}

export function InverterIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="3" y="7" width="34" height="26" rx="3" fill="#e6f4ff" stroke="#1677ff" strokeWidth="1.5"/>
      <text x="20" y="18" textAnchor="middle" fontSize="7.5" fill="#1677ff" fontWeight="700">DC</text>
      <line x1="8" y1="22" x2="32" y2="22" stroke="#1677ff" strokeWidth="0.8" strokeDasharray="2,2"/>
      <path d="M8 30 Q12 25 16 30 Q20 35 24 30 Q28 25 32 30" stroke="#1677ff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export function BatteryIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="2" y="11" width="32" height="18" rx="2.5" fill="#f6ffed" stroke="#52c41a" strokeWidth="1.5"/>
      <rect x="34" y="17" width="4" height="6" rx="1" fill="#52c41a"/>
      <rect x="5" y="14" width="6" height="12" rx="1" fill="#52c41a" opacity="0.9"/>
      <rect x="13" y="14" width="6" height="12" rx="1" fill="#52c41a" opacity="0.65"/>
      <rect x="21" y="14" width="6" height="12" rx="1" fill="#52c41a" opacity="0.35"/>
    </svg>
  );
}

export function ChargerIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="9" y="4" width="22" height="32" rx="4" fill="#fff0f6" stroke="#eb2f96" strokeWidth="1.5"/>
      <line x1="14" y1="4" x2="14" y2="9" stroke="#eb2f96" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="26" y1="4" x2="26" y2="9" stroke="#eb2f96" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M22 15 L17 23 H21 L18 31 L24 21 H20 Z" fill="#eb2f96"/>
    </svg>
  );
}

export function LoadIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="6" y="17" width="28" height="20" rx="1.5" fill="#f9f0ff" stroke="#722ed1" strokeWidth="1.5"/>
      <polygon points="20,4 4,17 36,17" fill="#f9f0ff" stroke="#722ed1" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="15" y="25" width="10" height="12" rx="1" fill="#722ed1" opacity="0.25"/>
      <rect x="8" y="21" width="6" height="6" rx="0.5" fill="#722ed1" opacity="0.45"/>
      <rect x="26" y="21" width="6" height="6" rx="0.5" fill="#722ed1" opacity="0.45"/>
    </svg>
  );
}

export function GridIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <line x1="20" y1="2" x2="20" y2="38" stroke="#fa8c16" strokeWidth="2"/>
      <line x1="8" y1="8" x2="32" y2="8" stroke="#fa8c16" strokeWidth="2"/>
      <line x1="11" y1="18" x2="29" y2="18" stroke="#fa8c16" strokeWidth="1.5"/>
      <line x1="8" y1="8" x2="20" y2="38" stroke="#fa8c16" strokeWidth="1.5"/>
      <line x1="32" y1="8" x2="20" y2="38" stroke="#fa8c16" strokeWidth="1.5"/>
      <line x1="11" y1="18" x2="20" y2="38" stroke="#fa8c16" strokeWidth="1"/>
      <line x1="29" y1="18" x2="20" y2="38" stroke="#fa8c16" strokeWidth="1"/>
      <circle cx="8" cy="8" r="2.5" fill="#fa8c16"/>
      <circle cx="32" cy="8" r="2.5" fill="#fa8c16"/>
      <circle cx="11" cy="18" r="2" fill="#fa8c16"/>
      <circle cx="29" cy="18" r="2" fill="#fa8c16"/>
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
