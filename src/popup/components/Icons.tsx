import React from 'react';

export type IconName =
  | 'document'
  | 'lock'
  | 'transfer'
  | 'upload'
  | 'refresh'
  | 'chevron-down'
  | 'chevron-up'
  | 'plus'
  | 'minus'
  | 'close'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'trash'
  | 'edit'
  | 'check'
  | 'clock'
  | 'info';

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export const AppBrandMark: React.FC = () => (
  <div className="brand-mark" aria-hidden="true">
    <svg width="36" height="36" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="28" fill="#c96442" />
      <circle cx="46" cy="58" r="34" fill="rgba(255,255,255,0.15)" />
      <circle cx="82" cy="58" r="34" fill="rgba(255,255,255,0.1)" />
      <g fill="#ffffff">
        <circle cx="46" cy="44" r="13" />
        <path d="M25 80c2.5-13.5 10.5-20 21-20s18.5 6.5 21 20c.6 3-1.5 5.5-4.5 5.5h-33c-3 0-5.1-2.5-4.5-5.5Z" />
      </g>
      <g fill="rgba(255,255,255,0.7)">
        <circle cx="82" cy="44" r="13" />
        <path d="M61 80c2.5-13.5 10.5-20 21-20s18.5 6.5 21 20c.6 3-1.5 5.5-4.5 5.5h-33c-3 0-5.1-2.5-4.5-5.5Z" />
      </g>
      <circle cx="100" cy="100" r="16" fill="#ffffff" />
      <g fill="none" stroke="#c96442" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M91 96h18" />
        <polyline points="105,92 109,96 105,100" />
        <path d="M109 104H91" />
        <polyline points="95,100 91,104 95,108" />
      </g>
    </svg>
  </div>
);

export const Icon: React.FC<IconProps> = ({ name, size = 16, className }) => {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'refresh' && (
        <>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </>
      )}
      {name === 'chevron-down' && <path d="m6 9 6 6 6-6" />}
      {name === 'chevron-up' && <path d="m18 15-6-6-6 6" />}
      {name === 'plus' && (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      )}
      {name === 'minus' && <path d="M5 12h14" />}
      {name === 'close' && (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      )}
      {name === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </>
      )}
      {name === 'moon' && <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />}
      {name === 'monitor' && (
        <>
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </>
      )}
      {name === 'document' && (
        <>
          <path d="M7 3.75h6l4 4v12.5H7z" />
          <path d="M13 3.75v4h4M9.75 12h4.5M9.75 15.5h4.5" />
        </>
      )}
      {name === 'lock' && (
        <>
          <rect x="5.5" y="10" width="13" height="10" rx="2.5" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2.5" />
        </>
      )}
      {name === 'transfer' && (
        <path d="M6.25 8h11.5M14.75 5l3 3-3 3M17.75 16H6.25M9.25 13l-3 3 3 3" />
      )}
      {name === 'upload' && (
        <>
          <path d="M12 16V5M8 9l4-4 4 4" />
          <path d="M5 15.5v3.75h14V15.5" />
        </>
      )}
      {name === 'trash' && (
        <>
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </>
      )}
      {name === 'edit' && (
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      )}
      {name === 'check' && <polyline points="20 6 9 17 4 12" />}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" />
        </>
      )}
      {name === 'info' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <circle cx="12" cy="8" r="0.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
};

