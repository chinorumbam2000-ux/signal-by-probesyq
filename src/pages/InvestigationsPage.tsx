import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LiveModeNote from '../components/live/LiveModeNote';
import Card from '../components/common/Card';
import PageMeta from '../components/common/PageMeta';
import { EmptyState, ErrorState } from '../components/common/States';
import SeverityBadge from '../components/signals/SeverityBadge';
import SignalInvestigation, { type InvestigationMode } from '../components/signals/SignalInvestigation';
import ProfileInvestigationShell from '../components/profiles/ProfileInvestigationShell';
import ProfileTypeTag from '../components/profiles/ProfileTypeTag';
import { useSimulation } from '../context/SimulationContext';
import {
  INVESTIGATION_STATUS_STYLES,
  REVIEW_DISCLAIMER,
  REVIEW_STATUS_LABEL,
  investigationPath,
  isUnderReview,
} from '../lib/investigationWorkflow';
import { REPORT_STATUS_STYLES } from '../lib/reporting';
import { findDetection } from '../lib/alerts';
import { findProfileDetection } from '../lib/profiles/portfolio';
import { PROFILE_BY_ID, RVS_PROFILE_ID, type ProfileId } from '../lib/profiles/registry';
import { useModeWording } from '../lib/modeWording';

/**
 * Investigations: the alerts that have entered review, and each one's review.
 *
 *   /investigations                       the investigations (alerts whose review has started)
 *   /investigations?alert=<id>            one investigation, at detection by default
 *   /investigations?alert=<id>&view=current   ... showing current conditions
 *   /investigations?view=current          current conditions, with no alert (Map and Facilities entry points)
 *
 * An alert arrives here from the Signals queue, where "Investigate" starts its
 * review. Its evidence, its review actions and "Prepare report" live here.
 * Keeping the view in the URL is what makes refresh and browser back/forward
 * restore the right screen; the alert's profile (?profile=) is kept with it.
 * Older /signals?alert=… links are forwarded here by the Signals page.
 */
const ALERT_PARAM = 'alert';
const VIEW_PARAM = 'view';

function DetailHeading({ profile, title }: { profile?: string; title: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="ls-label">Investigation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {profile ? `${profile} — ${title}` : title}
        </h1>
      </div>
      <PageMeta />
    </header>
  );
}

export default function InvestigationsPage() {
  const {
    currentDay,
    alerts,
    profileAlerts,
    dayOverDay,
    getInvestigation,
    runInvestigationAction,
    prepareReport,
    reports,
    error,
    clearError,
  } = useSimulation();
  const wording = useModeWording();
  // In Live Surveillance the replay's investigations are not shown as live ones: the note says where to go.
  const isLive = wording.mode === 'live';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertParam = searchParams.get(ALERT_PARAM);
  const viewParam = searchParams.get(VIEW_PARAM);
  const profileParam = searchParams.get('profile');
  const keepProfile = (): Record<string, string> => (profileParam ? { profile: profileParam } : {});
  const openList = () => setSearchParams(keepProfile());
  const isDetail = Boolean(alertParam) || viewParam === 'current';

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={clearError} />
      </Card>
    );
  }

  const backToList = (
    <button type="button" onClick={openList} className="ls-btn-primary">
      Back to investigations
    </button>
  );

  // Live Surveillance alerts are reviewed and acknowledged on Signals; the
  // detailed investigation and reports follow Scenario Replay in this release.
  if (isLive && isDetail) {
    return (
      <div className="space-y-5">
        <DetailHeading title="Investigation" />
        <Card>
          <EmptyState
            icon="!"
            title="Investigations follow Scenario Replay"
            message="In Live Surveillance, alerts are reviewed and acknowledged on the Signals page. The detailed investigation evidence and public-health reports are demonstrated through Scenario Replay in this release."
            action={
              <Link to="/signals" className="ls-btn-primary">
                Go to Signals
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (isDetail) {
    const selectedAlert = alertParam ? alerts.find((alert) => alert.id === alertParam) : undefined;
    const setMode = (mode: InvestigationMode) => {
      // Only the URL changes. The global simulation day, acknowledgements and
      // the stored alert history are all untouched.
      setSearchParams({ ...keepProfile(), ...(alertParam ? { [ALERT_PARAM]: alertParam } : {}), [VIEW_PARAM]: mode });
    };

    // An alert of another profile opens that profile's investigation —
    // never the Respiratory Viral Activity view.
    const profileDetection = alertParam ? findProfileDetection(alertParam) : undefined;
    if (alertParam && !selectedAlert && profileDetection && profileDetection.profileId !== RVS_PROFILE_ID) {
      const profileName = PROFILE_BY_ID[profileDetection.profileId].displayName;
      const profileAlert = profileAlerts.find((alert) => alert.id === alertParam);
      if (!profileAlert) {
        return (
          <div className="space-y-5">
            <DetailHeading profile={profileName} title={profileDetection.title} />
            <Card>
              <EmptyState
                icon="!"
                title="That alert has not been detected yet"
                message={`"${profileDetection.title}" (${profileName}) is first detected on replay Day ${profileDetection.detectedDay}. The replay is currently on Day ${currentDay}.`}
                action={backToList}
              />
            </Card>
          </div>
        );
      }
      return (
        <div className="space-y-5">
          <DetailHeading profile={profileName} title={profileAlert.title} />
          <ProfileInvestigationShell
            alert={profileAlert}
            investigation={getInvestigation(profileAlert.id)}
            onAction={(action, note) => runInvestigationAction(profileAlert.id, action, note)}
            onPrepareReport={() => {
              const failure = prepareReport(profileAlert.id);
              if (!failure) navigate(`/reports?profile=${encodeURIComponent(profileAlert.profileId)}`);
              return failure;
            }}
            hasReport={reports.some((report) => report.alertId === profileAlert.id)}
            onBack={openList}
          />
        </div>
      );
    }

    if (alertParam && !selectedAlert) {
      const detection = findDetection(alertParam);
      return (
        <div className="space-y-5">
          <DetailHeading
            profile={detection ? PROFILE_BY_ID[RVS_PROFILE_ID].displayName : undefined}
            title={detection ? detection.title : 'Investigation'}
          />
          <Card>
            <EmptyState
              icon="!"
              title={detection ? 'That alert has not been detected yet' : 'That alert could not be found'}
              message={
                detection
                  ? `"${detection.title}" is first detected on replay Day ${detection.detectedDay}. The replay is currently on Day ${currentDay}, so there is no detection-time breakdown to show. Advance to Day ${detection.detectedDay} or later, then start its review from Signals.`
                  : `No alert matches the reference "${alertParam}". It may be from an older session, or the link may be incomplete.`
              }
              action={backToList}
            />
          </Card>
        </div>
      );
    }

    const mode: InvestigationMode = viewParam === 'current' ? 'current' : 'detection';
    return (
      <div className="space-y-5">
        <DetailHeading
          profile={PROFILE_BY_ID[RVS_PROFILE_ID].displayName}
          title={selectedAlert ? selectedAlert.title : 'Current conditions'}
        />
        <SignalInvestigation
          alert={selectedAlert}
          currentDay={currentDay}
          mode={mode}
          onModeChange={setMode}
          onBack={openList}
          dayOverDay={dayOverDay}
          investigation={selectedAlert ? getInvestigation(selectedAlert.id) : undefined}
          onInvestigationAction={(action, note) =>
            selectedAlert ? runInvestigationAction(selectedAlert.id, action, note) : 'No signal selected.'
          }
          onPrepareReport={() => {
            if (!selectedAlert) return;
            const failure = prepareReport(selectedAlert.id);
            if (!failure) navigate(`/reports?profile=${encodeURIComponent(RVS_PROFILE_ID)}`);
          }}
          hasReport={selectedAlert ? reports.some((report) => report.alertId === selectedAlert.id) : false}
        />
      </div>
    );
  }

  // The list: only alerts whose review has started. New alerts stay in the Signals queue.
  const inReview = profileAlerts
    .map((alert) => ({ alert, investigation: getInvestigation(alert.id) }))
    .filter(({ investigation }) => isUnderReview(investigation))
    .sort(
      (a, b) =>
        b.alert.detectedDay - a.alert.detectedDay ||
        PROFILE_BY_ID[a.alert.profileId].displayName.localeCompare(PROFILE_BY_ID[b.alert.profileId].displayName) ||
        a.alert.title.localeCompare(b.alert.title),
    );
  const notStarted = profileAlerts.length - inReview.length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Investigations</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Signals that have entered review: their stage, owner, detection-time evidence, review actions and report.
          </p>
        </div>
        <PageMeta />
      </header>

      <LiveModeNote what="Investigations" />

      {isLive ? null : (
        <Card
          title="Under review"
          subtitle={
            notStarted > 0
              ? `${notStarted} ${notStarted === 1 ? 'alert has' : 'alerts have'} not started review yet: they are in the Signals queue.`
              : 'Every detected alert has started review.'
          }
          action={
            <Link to="/signals?profile=all" className="ls-btn px-3 py-1.5 text-xs">
              Signals queue →
            </Link>
          }
          bodyClassName="p-0"
        >
          {inReview.length === 0 ? (
            <EmptyState
              title="No investigation yet"
              message="An alert becomes an investigation when its review starts: choose Investigate on an alert in Signals."
              action={
                <Link to="/signals?profile=all" className="ls-btn-primary">
                  Go to Signals
                </Link>
              }
            />
          ) : (
            <>
            {/* Phones: one card per investigation, every field in words. */}
            <ul className="divide-y divide-hairline sm:hidden" aria-label="Investigations" data-testid="investigation-cards">
              {inReview.map(({ alert, investigation }) => {
                const profile = PROFILE_BY_ID[alert.profileId as ProfileId];
                const report = reports.find((item) => item.alertId === alert.id);
                const status = investigation!.status;
                return (
                  <li key={alert.id} className="space-y-2 px-4 py-3">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
                      {profile.displayName} <ProfileTypeTag profile={profile} />
                    </p>
                    <p className="text-sm text-ink">
                      {alert.title} <span className="text-xs text-muted">· detected {wording.day(alert.detectedDay)}</span>
                    </p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-muted">Severity at detection</dt>
                      <dd><SeverityBadge severity={alert.detection.severity} /></dd>
                      <dt className="text-muted">Review status</dt>
                      <dd>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVESTIGATION_STATUS_STYLES[status]}`}>
                          {REVIEW_STATUS_LABEL[status]}
                        </span>
                      </dd>
                      <dt className="text-muted">Assigned</dt>
                      <dd className="text-ink">{investigation!.assignedInvestigator ?? 'Unassigned'}</dd>
                      <dt className="text-muted">Report</dt>
                      <dd className="text-ink">{report ? report.status : 'Not prepared'}</dd>
                    </dl>
                    <Link
                      to={investigationPath(alert.id, alert.profileId)}
                      className="ls-btn inline-flex px-3 py-1.5 text-xs"
                      aria-label={`Open investigation: ${profile.displayName} — ${alert.title}`}
                    >
                      Open investigation
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="hidden w-full overflow-x-auto sm:block" tabIndex={0} role="region" aria-label="Investigations table">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="sr-only">Signals under review, with their review stage, owner and report</caption>
                <thead className="border-b border-hairline bg-canvas">
                  <tr>
                    <th scope="col" className="ls-th">Signal</th>
                    <th scope="col" className="ls-th">Severity at detection</th>
                    <th scope="col" className="ls-th">Review status</th>
                    <th scope="col" className="ls-th">Assigned</th>
                    <th scope="col" className="ls-th">Report</th>
                    <th scope="col" className="ls-th text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {inReview.map(({ alert, investigation }) => {
                    const profile = PROFILE_BY_ID[alert.profileId as ProfileId];
                    const report = reports.find((item) => item.alertId === alert.id);
                    const status = investigation!.status;
                    return (
                      <tr key={alert.id} data-testid="investigation-row">
                        <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                          <span className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                            {profile.displayName}
                            <ProfileTypeTag profile={profile} />
                          </span>
                          <span className="block text-ink">{alert.title}</span>
                          <span className="block text-xs text-muted">Detected {wording.day(alert.detectedDay)}</span>
                        </th>
                        <td className="ls-td align-top">
                          <SeverityBadge severity={alert.detection.severity} />
                        </td>
                        <td className="ls-td align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVESTIGATION_STATUS_STYLES[status]}`}
                          >
                            {REVIEW_STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="ls-td align-top text-ink">{investigation!.assignedInvestigator ?? 'Unassigned'}</td>
                        <td className="ls-td align-top">
                          {report ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${REPORT_STATUS_STYLES[report.status]}`}
                            >
                              {report.status}
                            </span>
                          ) : (
                            <span className="text-muted">Not prepared</span>
                          )}
                        </td>
                        <td className="ls-td text-right align-top">
                          <Link
                            to={investigationPath(alert.id, alert.profileId)}
                            className="ls-btn whitespace-nowrap px-3 py-1.5 text-xs"
                            aria-label={`Open investigation: ${profile.displayName} — ${alert.title}`}
                          >
                            Open investigation
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Card>
      )}

      <p className="text-xs text-muted">{REVIEW_DISCLAIMER}</p>
    </div>
  );
}
