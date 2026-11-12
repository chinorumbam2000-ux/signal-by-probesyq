import type { DayOverDayComparison } from '../../types';
import { useModeWording } from '../../lib/modeWording';

/**
 * Why the score moved since the previous day — the day-over-day comparison's
 * own explanation, built by the existing engine from whatever component
 * inputs actually moved. Nothing here recalculates or re-reasons.
 */
export default function ScoreMovement({ comparison }: { comparison: DayOverDayComparison }) {
  const wording = useModeWording();
  const previousDay = comparison.previousDay ?? comparison.currentDay - 1;
  const delta = comparison.scoreDelta;
  return (
    <div className="ls-card px-4 py-3" data-testid="score-movement">
      <h3 className="text-sm font-semibold text-ink">
        Why the score moved
        {comparison.available ? (
          <span className="font-normal text-muted">
            {' '}
            · {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
            {Math.abs(delta)} since {wording.day(previousDay)}
          </span>
        ) : null}
      </h3>
      {comparison.available ? (
        <p className="mt-1 text-sm leading-relaxed text-ink">{comparison.explanation}</p>
      ) : (
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Baseline — no previous surveillance day available. {wording.noPreviousDay}
        </p>
      )}
    </div>
  );
}
