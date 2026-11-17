import type { ReactNode } from 'react';

/**
 * The landing page's line icons: 24px, one stroke weight, drawn in
 * currentColor. Always decorative — each sits beside its own visible text.
 */
function Icon({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

/** A signal rising out of a flat baseline. */
export const PulseIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3 13h4l2-5 3 10 2.5-7 1.5 2H21" />
  </Icon>
);

/** Stacked surveillance profiles. */
export const LayersIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);

/** A detection ring with its caught signal. */
export const RadarIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="11" cy="12" r="7.5" />
    <circle cx="11" cy="12" r="3.5" />
    <path d="m13.5 14.5 6 6" />
  </Icon>
);

/** Two systems exchanging messages. */
export const ExchangeIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5" />
    <path d="M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5" />
  </Icon>
);

/** A trend over a location marker. */
export const ChartMapIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3 20h18" />
    <path d="M5 16l4-5 3 3 4-6 3 4" />
    <circle cx="16" cy="8" r="1.2" />
  </Icon>
);

/** A clipboard with a completed review. */
export const ClipboardIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3h6v1.5" />
    <path d="m9 13 2 2 4-4.5" />
  </Icon>
);

/** A laboratory flask. */
export const FlaskIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9.5 3h5M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
    <path d="M7.5 15h9" />
  </Icon>
);

/** An early-warning bell. */
export const BellIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

/** A check, for list items. */
export const CheckIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

/** An information mark, for the disclosure. */
export const InfoIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5v.01" />
  </Icon>
);
