import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import Card from '../components/common/Card';
import PageMeta from '../components/common/PageMeta';
import SignalTable from '../components/signals/SignalTable';
import { ErrorState, LoadingState } from '../components/common/States';
import { SIGNAL_DISCLAIMER } from '../lib/signalScore';
import { SCORE_DISCLAIMER_TEXT } from '../lib/brand';
import { formatSimulationDateTime } from '../lib/format';
import MethodNote from '../components/common/MethodNote';
import { usePortfolio } from '../lib/profiles/usePortfolio';
import ProfileSelector from '../components/profiles/ProfileSelector';
import { PROFILE_BY_ID, RVS_PROFILE_ID } from '../lib/profiles/registry';
import { SEVERITY_RANK, type ProfileAlert } from '../lib/profiles/portfolio';
import { isScope } from '../lib/profiles/selection';
import { INVESTIGATIONS_PATH, investigationPath } from '../lib/investigationWorkflow';
import { useLiveSurveillance } from '../context/LiveSurveillanceContext';
import { useModeWording } from '../lib/modeWording';
import type { OutbreakAlert } from '../types';

/**
 * Signals: the alert queue. Every detected alert, whether it has been
 * acknowledged and whether its review has started. "Investigate" starts an
 * alert's review and continues on Investigations, which owns the evidence and
 * the review workflow; an alert already in review offers "Open Investigation".
 *
 * Older links to an investigation on this page (?alert=<id>, ?view=current)
 * are forwarded to the same view on Investigations, with every query
 * parameter (the profile included) kept, so bookmarks and history still work.
 */
export default function SignalsPage() {
  const {
    alerts,
    getInvestigation,
    beginInvestigation,
    acknowledgeAlert,
    isLoading,
    error,
    clearError,
  } = useSimulation();
  const wording = useModeWording();
  const navigate = useNavigate();
  const { search, hash } = useLocation();
  // The alert list follows the selected surveillance profile (?profile=):
  // Respiratory Viral Activity by default, exactly as before; "All profiles"
  // lists every profile's alerts together, each labelled with its profile.
  const portfolio = usePortfolio();
  const { selection, view, period } = portfolio;
  const live = useLiveSurveillance();
  const isLive = live.mode === 'live';
  const acknowledge = isLive ? live.acknowledge : acknowledgeAlert;

  // A legacy investigation link: the investigation now lives on Investigations.
  const params = new URLSearchParams(search);
  if (params.has('alert') || params.has('view')) {
    return <Navigate to={`${INVESTIGATIONS_PATH}${search}${hash}`} replace />;
  }

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={clearError} />
      </Card>
    );
  }

  const profileOfAlert = (alert: OutbreakAlert): string =>
    'profileId' in alert ? (alert as ProfileAlert).profileId : RVS_PROFILE_ID;
  // The review workflow follows Scenario Replay in this release: in Live the queue acknowledges only.
  const review = isLive
    ? undefined
    : {
        statusOf: (alert: OutbreakAlert) => getInvestigation(alert.id)?.status ?? 'NEW',
        investigationPath: (alert: OutbreakAlert) => investigationPath(alert.id, profileOfAlert(alert)),
        onInvestigate: (alert: OutbreakAlert) => {
          if (beginInvestigation(alert.id) === null) navigate(investigationPath(alert.id, profileOfAlert(alert)));
        },
      };

  const activeProfiles = new Set(
    portfolio.summaries.filter((s) => s.status === 'ACTIVE_SIGNAL').map((s) => s.profile.id),
  );
  const multiProfile = isScope(selection);
  const listAlerts: Array<ProfileAlert | (typeof alerts)[number]> =
    selection === RVS_PROFILE_ID && !isLive
      ? alerts
      : multiProfile
        ? portfolio.alerts
            .filter((alert) => selection === 'all' || activeProfiles.has(alert.profileId))
            .sort(
              (a, b) =>
                SEVERITY_RANK[b.detection.severity] - SEVERITY_RANK[a.detection.severity] ||
                b.detectedDay - a.detectedDay ||
                PROFILE_BY_ID[a.profileId].displayName.localeCompare(PROFILE_BY_ID[b.profileId].displayName),
            )
        : portfolio.alerts.filter((alert) => alert.profileId === selection);
  const profileNames = multiProfile
    ? Object.fromEntries(portfolio.alerts.map((alert) => [alert.id, PROFILE_BY_ID[alert.profileId].displayName]))
    : undefined;
  const profileIds = multiProfile
    ? Object.fromEntries(portfolio.alerts.map((alert) => [alert.id, alert.profileId]))
    : undefined;
  const otherProfileAlerts = multiProfile ? 0 : portfolio.alerts.length - listAlerts.length;
  const unacknowledgedCount = listAlerts.filter((alert) => alert.status !== 'Acknowledged').length;
  const newTodayCount = listAlerts.filter((alert) => alert.detectedDay === period.day).length;
  const acknowledged = listAlerts.filter((alert) => alert.status === 'Acknowledged');
  const nameOf = (alert: { id: string; title: string }) =>
    profileNames?.[alert.id] ? `${profileNames[alert.id]} — ${alert.title}` : alert.title;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Signals &amp; Alerts
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            The alert queue: every detected alert, its acknowledgement and whether its review has started. Each alert
            reports the values recorded when it was detected; those values {wording.frozenValues}.
            {isLive ? null : ' Investigate starts an alert’s review, which continues on Investigations.'}
          </p>
        </div>
        <PageMeta />
      </header>

      <div className="flex flex-col gap-1">
        <ProfileSelector portfolio={portfolio} />
        {otherProfileAlerts > 0 ? (
          <p className="text-xs text-muted">
            Showing {view.profile.displayName} alerts. {otherProfileAlerts} more{' '}
            {otherProfileAlerts === 1 ? 'alert belongs' : 'alerts belong'} to other profiles —{' '}
            <button
              type="button"
              onClick={() => portfolio.setSelection('all')}
              className="font-semibold text-brand hover:underline"
            >
              show all profiles
            </button>
            .
          </p>
        ) : null}
      </div>

      {/* Queue-level counts only: the selected profile's score and scope are on the Dashboard. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="queue-counts">
        <div className="ls-card p-5">
          <p className="ls-label">Alerts awaiting acknowledgement</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
            {unacknowledgedCount}
          </p>
          <p className="mt-1 text-xs text-muted">
            of {listAlerts.length} {listAlerts.length === 1 ? 'alert' : 'alerts'} detected so far
          </p>
        </div>
        <div className="ls-card p-5">
          <p className="ls-label">Detected on this day</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
            {newTodayCount}
          </p>
          <p className="mt-1 text-xs text-muted">
            {acknowledged.length} acknowledged so far
          </p>
        </div>
      </div>

      <Card
        title="Alert queue"
        subtitle="Scores and severities are frozen at detection. The evidence and the review are on each alert's investigation."
        bodyClassName="p-0"
      >
        {isLoading ? (
          <LoadingState label="Loading alerts…" />
        ) : (
          <SignalTable
            alerts={listAlerts}
            onAcknowledge={acknowledge}
            review={review}
            profileNames={profileNames}
            profileIds={profileIds}
            emptyMessage={
              selection === RVS_PROFILE_ID
                ? undefined
                : `No ${multiProfile ? '' : `${view.profile.displayName} `}alert has been raised through ${period.currentLabel}.`
            }
          />
        )}
      </Card>

      {/* The queue holds detection-time values; the current figures belong to the Dashboard. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted" data-testid="current-figures-link">
        <span>Current figures for {view.profile.displayName} are on the Dashboard.</span>
        <Link
          to={`/dashboard?profile=${encodeURIComponent(view.profile.id)}`}
          className="font-semibold text-brand hover:underline"
        >
          View profile on Dashboard <span aria-hidden="true">→</span>
        </Link>
        {view.isNarrated && !isLive ? (
          <Link
            to={`${INVESTIGATIONS_PATH}?profile=${encodeURIComponent(view.profile.id)}&view=current`}
            className="font-semibold text-brand hover:underline"
          >
            Investigate current conditions <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </p>

      {acknowledged.length > 0 ? (
        <Card title="Acknowledgement log" bodyClassName="p-0">
          <ul className="divide-y divide-hairline">
            {acknowledged.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <span className="text-sm text-ink">{nameOf(alert)}</span>
                <span className="text-xs text-muted">
                  {/* Live's timeline is its own: the day label is the date; replay adds its scenario timestamp. */}
                  Acknowledged on {alert.acknowledgement ? wording.day(alert.acknowledgement.day) : ''}
                  {!isLive && alert.acknowledgement
                    ? ` · ${formatSimulationDateTime(alert.acknowledgement.simulationTime)} (scenario time)`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="ls-card border-l-4 border-l-severity-critical p-5">
        <p className="text-sm font-semibold text-ink">{SIGNAL_DISCLAIMER}</p>
        <MethodNote className="mt-2">{SCORE_DISCLAIMER_TEXT}</MethodNote>
      </div>
    </div>
  );
}
