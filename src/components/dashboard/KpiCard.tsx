import type { ReactNode } from 'react';
import type { ChangeDirection } from '../../types';

/** Movement since the previous day, as the day-over-day comparison reports it. */
export interface KpiChange {
  /** The comparison's own formatted delta, e.g. "+18", "−1.2 percentage points", "No change". */
  delta: string;
  direction: ChangeDirection;
  /** The day compared with, e.g. "Feb 11" or "Day 4". */
  since: string;
  /** The small-count rule withholds this change: no figure and no direction is shown. */
  withheld?: boolean;
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  change?: KpiChange | null;
  footnote?: string;
}

const TONE_CLASSES: Record<ChangeDirection, string> = {
  up: 'text-severity-critical',
  down: 'text-[#166534]',
  none: 'text-muted',
};

const GLYPH: Record<ChangeDirection, string> = { up: '↑', down: '↓', none: '→' };
/** Direction in words for screen readers: the arrow and colour are decoration only. */
const SPOKEN: Record<ChangeDirection, string> = { up: 'Up', down: 'Down', none: 'Unchanged' };

export default function KpiCard({ label, value, change, footnote }: KpiCardProps) {
  return (
    <div className="ls-card p-5" data-testid="kpi-card">
      <p className="ls-label">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none tabular-nums text-ink">{value}</p>
      {change?.withheld ? (
        <p className="mt-2 text-xs font-medium text-muted" data-testid="kpi-change">
          Change since {change.since} withheld (fewer than 5)
        </p>
      ) : change ? (
        <p className={`mt-2 text-xs font-medium ${TONE_CLASSES[change.direction]}`} data-testid="kpi-change">
          <span aria-hidden="true">{GLYPH[change.direction]} </span>
          <span className="sr-only">{SPOKEN[change.direction]}: </span>
          {change.delta} vs {change.since}
        </p>
      ) : null}
      {footnote ? <p className="mt-2 text-xs text-muted">{footnote}</p> : null}
    </div>
  );
}
