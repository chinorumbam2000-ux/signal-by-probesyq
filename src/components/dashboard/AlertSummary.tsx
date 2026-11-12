import { Link } from 'react-router-dom';
import SeverityBadge from '../signals/SeverityBadge';
import { PROFILE_BY_ID } from '../../lib/profiles/registry';
import { SEVERITY_RANK, type ProfileAlert } from '../../lib/profiles/portfolio';
import { useModeWording } from '../../lib/modeWording';
import { SIGNAL_DISCLAIMER } from '../../lib/signalScore';

/** The Signals queue across every profile, where these alerts are reviewed. */
export const SIGNALS_QUEUE_PATH = '/signals?profile=all';

/**
 * The alerts awaiting review, in the Signals queue's own order (severity,
 * then most recently detected, then profile name), so the Dashboard's
 * "highest priority" is the first unacknowledged row of Signals' All profiles
 * view.
 */
export const alertsAwaitingReview = (alerts: ProfileAlert[]): ProfileAlert[] =>
  alerts
    .filter((alert) => alert.status !== 'Acknowledged')
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.detection.severity] - SEVERITY_RANK[a.detection.severity] ||
        b.detectedDay - a.detectedDay ||
        PROFILE_BY_ID[a.profileId].displayName.localeCompare(PROFILE_BY_ID[b.profileId].displayName),
    );

/**
 * One line about alerts: the highest-priority alert awaiting review and how
 * many are waiting. Read-only — alerts are acknowledged and investigated on
 * the Signals page, which this links to.
 */
export default function AlertSummary({ alerts }: { alerts: ProfileAlert[] }) {
  const wording = useModeWording();
  const awaiting = alertsAwaitingReview(alerts);
  const top = awaiting[0];
  const count = awaiting.length;

  return (
    <div className="ls-card px-4 py-3" data-testid="alert-summary">
      {top ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="top-alert">
          <SeverityBadge severity={top.detection.severity} />
          <p className="min-w-0 text-sm text-ink">
            <span className="font-semibold">{PROFILE_BY_ID[top.profileId].displayName}</span> — {top.title}
            <span className="text-muted">
              {' '}
              · score {top.detection.compositeScore} at detection · detected{' '}
              {wording.day(top.detectedDay)}
            </span>
          </p>
        </div>
      ) : (
        <p className="text-sm font-semibold text-ink" data-testid="top-alert">
          No alerts require review
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-muted">
          <span data-testid="alerts-awaiting">
            {count === 0
              ? alerts.length === 0
                ? 'No alerts raised.'
                : 'Every alert has been acknowledged.'
              : `${count} ${count === 1 ? 'alert' : 'alerts'} awaiting review`}
          </span>
          {top ? <> · {SIGNAL_DISCLAIMER}</> : null}
        </p>
        <Link to={SIGNALS_QUEUE_PATH} className="text-xs font-semibold text-brand hover:underline" data-testid="signals-link">
          {count === 0 ? 'Open Signals' : 'Review in Signals'} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
