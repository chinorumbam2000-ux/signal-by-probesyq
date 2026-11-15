import type { ChangeDirection, DayOverDayComparison } from '../../types';
import { useModeWording } from '../../lib/modeWording';

const DIRECTION_STYLES: Record<ChangeDirection, string> = {
  up: 'text-severity-critical',
  down: 'text-[#166534]',
  none: 'text-muted',
};

const DIRECTION_GLYPH: Record<ChangeDirection, string> = {
  up: '↑',
  down: '↓',
  none: '→',
};

const DIRECTION_WORD: Record<ChangeDirection, string> = {
  up: 'Up',
  down: 'Down',
  none: 'Unchanged',
};

/** The score's own row: its movement is the header and "Why the score moved". */
const SCORE_METRIC = 'Composite Outbreak Signal Score';

interface DayOverDayChangeProps {
  comparison: DayOverDayComparison;
  /**
   * Only what moved, as a short list, then why the score moved — where the
   * full figures are already on screen (Scenario Replay's Current State).
   */
  concise?: boolean;
  className?: string;
}

/**
 * What changed between the previous simulation day and this one, and why the
 * Composite Outbreak Signal Score moved. Reads the existing scorer — it never
 * recalculates the score itself.
 */
export default function DayOverDayChange({
  comparison,
  concise = false,
  className = '',
}: DayOverDayChangeProps) {
  const wording = useModeWording();
  const previousDay = comparison.previousDay ?? comparison.currentDay - 1;
  if (!comparison.available) {
    return (
      <section className={`ls-card ${className}`} aria-label="Day-to-day change" data-testid="day-change">
        <header className="ls-card-header">
          <h2 className="ls-card-title">Change since previous day</h2>
        </header>
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-medium text-ink">
            Baseline — no previous surveillance day available.
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {wording.noPreviousDay}
          </p>
        </div>
      </section>
    );
  }

  if (concise) {
    const moved = comparison.metrics.filter((metric) => metric.label !== SCORE_METRIC && metric.direction !== 'none');
    const delta = comparison.scoreDelta;
    return (
      <section className={`ls-card ${className}`} aria-label="Day-to-day change" data-testid="day-change">
        <header className="ls-card-header">
          <h2 className="ls-card-title">Change since {wording.day(previousDay)}</h2>
          <span className={`text-sm font-semibold tabular-nums ${DIRECTION_STYLES[delta > 0 ? 'up' : delta < 0 ? 'down' : 'none']}`}>
            Score {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
            {Math.abs(delta)}
          </span>
        </header>
        <div className="px-5 py-4">
          {moved.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-2" data-testid="day-change-metrics">
              {moved.map((metric) => (
                <li key={metric.label} className="text-sm text-ink">
                  <span className="text-muted">{metric.label}</span>{' '}
                  <span className="tabular-nums">
                    {metric.previous} → <span className="font-semibold">{metric.current}</span>
                  </span>{' '}
                  <span className={`font-medium ${DIRECTION_STYLES[metric.direction]}`}>
                    (<span aria-hidden="true">{DIRECTION_GLYPH[metric.direction]} </span>
                    <span className="sr-only">{DIRECTION_WORD[metric.direction]}: </span>
                    {metric.delta})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No indicator moved since the previous day.</p>
          )}
        </div>
        <div className="border-t border-hairline bg-canvas px-5 py-3.5">
          <p className="ls-label">Why the score moved</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{comparison.explanation}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`ls-card ${className}`} aria-label="Day-to-day change">
      <header className="ls-card-header">
        <h2 className="ls-card-title">
          Change: {wording.day(previousDay)} → {wording.day(comparison.currentDay)}
        </h2>
        <span
          className={`text-sm font-semibold tabular-nums ${
            DIRECTION_STYLES[
              comparison.scoreDelta > 0 ? 'up' : comparison.scoreDelta < 0 ? 'down' : 'none'
            ]
          }`}
        >
          Score {comparison.scoreDelta > 0 ? '+' : ''}
          {comparison.scoreDelta}
        </span>
      </header>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <caption className="sr-only">
            {wording.comparison(previousDay, comparison.currentDay)}
          </caption>
          <thead className="border-b border-hairline bg-canvas">
            <tr>
              <th scope="col" className="ls-th">Metric</th>
              <th scope="col" className="ls-th text-right">
                {wording.day(previousDay)}
              </th>
              <th scope="col" className="ls-th text-right">
                {wording.day(comparison.currentDay)}
              </th>
              <th scope="col" className="ls-th text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {comparison.metrics.map((metric) => (
              <tr key={metric.label} className="hover:bg-canvas">
                <td className="ls-td">{metric.label}</td>
                <td className="ls-td text-right tabular-nums text-muted">
                  {metric.previous}
                </td>
                <td className="ls-td text-right font-semibold tabular-nums">
                  {metric.current}
                </td>
                <td
                  className={`ls-td text-right font-medium ${DIRECTION_STYLES[metric.direction]}`}
                >
                  <span aria-hidden="true">{DIRECTION_GLYPH[metric.direction]}</span>{' '}
                  {metric.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-hairline bg-canvas px-5 py-3.5">
        <p className="ls-label">Why the score moved</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{comparison.explanation}</p>
      </div>
    </section>
  );
}
