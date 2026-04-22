import type { ReactElement } from 'react';

export function Logo({ size = 32 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sun circle */}
      <circle cx="24" cy="15" r="8" fill="#fbbf24" opacity={0.95} />
      {/* Sun rays */}
      <g stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" opacity={0.6}>
        <line x1="24" y1="3" x2="24" y2="5.5" />
        <line x1="33.5" y1="6.5" x2="31.5" y2="8.5" />
        <line x1="37" y1="15" x2="34" y2="15" />
        <line x1="33.5" y1="23.5" x2="31.5" y2="21.5" />
        <line x1="14.5" y1="23.5" x2="16.5" y2="21.5" />
        <line x1="11" y1="15" x2="14" y2="15" />
        <line x1="14.5" y1="6.5" x2="16.5" y2="8.5" />
      </g>
      {/* Solar panel */}
      <rect x="8" y="27" width="32" height="17" rx="2.5" fill="#3b82f6" />
      <rect x="8" y="27" width="32" height="17" rx="2.5" stroke="#2563eb" strokeWidth="0.8" />
      {/* Panel grid lines */}
      <line x1="18.5" y1="27" x2="18.5" y2="44" stroke="#2563eb" strokeWidth="0.6" opacity={0.5} />
      <line x1="29.5" y1="27" x2="29.5" y2="44" stroke="#2563eb" strokeWidth="0.6" opacity={0.5} />
      <line x1="8" y1="33.5" x2="40" y2="33.5" stroke="#2563eb" strokeWidth="0.6" opacity={0.5} />
      <line x1="8" y1="39" x2="40" y2="39" stroke="#2563eb" strokeWidth="0.6" opacity={0.5} />
      {/* Panel reflection */}
      <rect x="10" y="29" width="8" height="3.5" rx="1" fill="white" opacity={0.1} />
      {/* Lightning bolt */}
      <path d="M26 11 L22 17 L25 17 L23 23 L29 15 L26 15 Z" fill="#fff" opacity={0.9} />
    </svg>
  );
}
