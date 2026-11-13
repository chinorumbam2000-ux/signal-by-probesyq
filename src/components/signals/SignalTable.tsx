import { Link } from 'react-router-dom';
import type { InvestigationStatus, OutbreakAlert } from '../../types';
import { formatSimulationDateTime } from '../../lib/format';
import SeverityBadge from './SeverityBadge';
import { EmptyState } from '../common/States';
import ProfileTypeTag from '../profiles/ProfileTypeTag';
import { PROFILE_BY_ID, type ProfileId } from '../../lib/profiles/registry';
import { useModeWording } from '../../lib/modeWording';
import { INVESTIGATION_STATUS_STYLES, REVIEW_STATUS_LABEL } from '../../lib/investigationWorkflow';

interface SignalTableProps {
  alerts: OutbreakAlert[];
  onAcknowledge: (alertId: string) => void;
  /**
   * The review workflow, where it exists (Scenario Replay): each alert's
   * review status, how to start its review ("Investigate") and where its
   * investigation lives once started ("Open Investigation"). Without it the
   * table offers acknowledgement only.
   */
  review?: {
    statusOf: (alert: OutbreakAlert) => InvestigationStatus;
    onInvestigate: (alert: OutbreakAlert) => void;
    investigationPath: (alert: OutbreakAlert) => string;
  };
  /**
   * The surveillance profile each alert belongs to, by alert id. When given,
   * the table gains a Profile column (alerts from several profiles).
   */
  profileNames?: Record<string, string>;
  /** Each alert's profile, for its Aggregate / Pathogen tag in the Profile column. */
  profileIds?: Record<string, ProfileId>;
  /** Shown when there are no alerts. */
  emptyMessage?: string;
}

const STATUS_STYLES: Record<OutbreakAlert['status'], string> = {
  New: 'bg-brand-light text-brand ring-1 ring-inset ring-brand/20',
  Active: 'bg-severity-high/10 text-[#9A3412] ring-1 ring-inset ring-severity-high/25',
  Acknowledged: 'bg-canvas text-muted ring-1 ring-inset ring-hairline',
};

/** A detection detail that is nothing but the composite score ("Composite Score: 66"). */
const SCORE_ONLY_DETAIL = /^Composite Score: \d+$/;

/**
 * The Signals alert queue: one row per alert with what it is, its score and
 * severity at detection, when it was detected, whether it has been
 * acknowledged and whether its review has started. The evidence and the
 * review itself belong to the alert's investigation, on Investigations.
 */
export default function SignalTable({
  alerts,
  onAcknowledge,
  review,
  profileNames,
  profileIds,
  emptyMessage,
}: SignalTableProps) {
  const wording = useModeWording();
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon="✓"
        title={wording.noAlerts}
        message={
          emptyMessage ??
          'Regional respiratory activity is at the expected baseline, so no Signal by ProbeSyQ alert has been raised. Advance the replay day to watch alerts appear as the signal develops.'
        }
      />
    );
  }
  const profileOf = (alert: OutbreakAlert) => profileNames?.[alert.id];
  const nameOf = (alert: OutbreakAlert) => `${profileOf(alert) ? `${profileOf(alert)} — ` : ''}${alert.title}`;
  // The Score column carries the score; a description that only restates it adds nothing.
  const descriptionOf = (alert: OutbreakAlert) =>
    SCORE_ONLY_DETAIL.test(alert.detection.detail) ? null : alert.detection.detail;

  return (
    <div className="w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Alert queue table">
      <table className="w-full min-w-[820px] border-collapse">
        <caption className="sr-only">
          Alert queue. Scores and severities are those recorded when each alert was detected.
        </caption>
        <thead className="border-b border-hairline bg-canvas">
          <tr>
            <th scope="col" className="ls-th">Detected</th>
            {profileNames ? <th scope="col" className="ls-th">Profile</th> : null}
            <th scope="col" className="ls-th">Alert</th>
            <th scope="col" className="ls-th text-right">Score</th>
            <th scope="col" className="ls-th">Severity</th>
            <th scope="col" className="ls-th">Acknowledgement</th>
            {review ? <th scope="col" className="ls-th">Review</th> : null}
            <th scope="col" className="ls-th text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {alerts.map((alert) => {
            const reviewStatus = review?.statusOf(alert) ?? null;
            const inReview = reviewStatus !== null && reviewStatus !== 'NEW';
            return (
              <tr key={alert.id} className="transition-colors hover:bg-canvas" data-testid="alert-row">
                <td className="ls-td text-muted">
                  <span className="block">{formatSimulationDateTime(alert.detectedAt)}</span>
                  {wording.dayTag(alert.detectedDay) ? (
                    <span className="block text-[11px]">{wording.dayTag(alert.detectedDay)}</span>
                  ) : null}
                </td>
                {profileNames ? (
                  <td className="ls-td font-medium text-ink">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {profileOf(alert)}
                      {profileIds?.[alert.id] ? <ProfileTypeTag profile={PROFILE_BY_ID[profileIds[alert.id]]} /> : null}
                    </span>
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-ink">{alert.title}</p>
                  {descriptionOf(alert) ? <p className="text-xs text-muted">{descriptionOf(alert)}</p> : null}
                </td>
                <td className="ls-td text-right tabular-nums text-ink">
                  {alert.detection.compositeScore}
                  <span className="sr-only"> out of 100 at detection</span>
                </td>
                <td className="ls-td">
                  <SeverityBadge severity={alert.detection.severity} />
                </td>
                <td className="ls-td">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ${
                      STATUS_STYLES[alert.status]
                    }`}
                  >
                    {alert.status === 'New' ? 'New today' : alert.status}
                  </span>
                  {alert.acknowledgement ? (
                    <span className="mt-1 block text-[11px] text-muted">
                      on {wording.day(alert.acknowledgement.day)}
                    </span>
                  ) : null}
                </td>
                {review && reviewStatus ? (
                  <td className="ls-td" data-testid="review-status">
                    {inReview ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVESTIGATION_STATUS_STYLES[reviewStatus]}`}
                      >
                        {REVIEW_STATUS_LABEL[reviewStatus]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Not started</span>
                    )}
                  </td>
                ) : null}
                <td className="ls-td">
                  <div className="flex items-center justify-end gap-2">
                    {alert.status === 'Acknowledged' ? null : (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(alert.id)}
                        className="ls-btn px-3 py-1.5 text-xs"
                        aria-label={`Acknowledge alert: ${nameOf(alert)}, detected on ${wording.detectedOn(alert.detectedDay)}`}
                      >
                        Acknowledge
                      </button>
                    )}
                    {review ? (
                      inReview ? (
                        <Link
                          to={review.investigationPath(alert)}
                          className="ls-btn whitespace-nowrap px-3 py-1.5 text-xs"
                          aria-label={`Open investigation: ${nameOf(alert)}`}
                        >
                          Open Investigation
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => review.onInvestigate(alert)}
                          className="ls-btn px-3 py-1.5 text-xs"
                          aria-label={`Investigate alert: ${nameOf(alert)} — starts its review on Investigations`}
                        >
                          Investigate
                        </button>
                      )
                    ) : alert.status === 'Acknowledged' ? (
                      <span className="text-xs text-muted">Acknowledged</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
