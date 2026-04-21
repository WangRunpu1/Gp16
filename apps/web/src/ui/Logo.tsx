import type { ReactElement } from 'react';

export function Logo({ size = 32 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sun circle */}
      <circle cx="24" cy="16" r="8" fill="#faad14" opacity={0.9} />
      {/* Sun rays */}
      <g stroke="#faad14" strokeWidth="2" strokeLinecap="round" opacity={0.7}>
        <line x1="24" y1="3" x2="24" y2="6" />
        <line x1="33" y1="7" x2="31" y2="9" />
        <line x1="37" y1="16" x2="34" y2="16" />
        <line x1="33" y1="25" x2="31" y2="23" />
        <line x1="15" y1="25" x2="17" y2="23" />
        <line x1="11" y1="16" x2="14" y2="16" />
        <line x1="15" y1="7" x2="17" y2="9" />
      </g>
      {/* Solar panel */}
      <rect x="8" y="28" width="32" height="16" rx="2" fill="#1677ff" />
      <rect x="8" y="28" width="32" height="16" rx="2" stroke="#0958d9" strokeWidth="1" />
      {/* Panel grid lines */}
      <line x1="18.5" y1="28" x2="18.5" y2="44" stroke="#0958d9" strokeWidth="0.8" opacity={0.5} />
      <line x1="29.5" y1="28" x2="29.5" y2="44" stroke="#0958d9" strokeWidth="0.8" opacity={0.5} />
      <line x1="8" y1="34" x2="40" y2="34" stroke="#0958d9" strokeWidth="0.8" opacity={0.5} />
      <line x1="8" y1="40" x2="40" y2="40" stroke="#0958d9" strokeWidth="0.8" opacity={0.5} />
      {/* Lightning bolt */}
      <path d="M26 12 L22 18 L25 18 L23 24 L29 16 L26 16 Z" fill="#fff" opacity={0.85} />
    </svg>
  );
}
