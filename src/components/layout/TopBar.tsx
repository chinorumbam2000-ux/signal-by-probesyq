import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSimulation } from '../../context/SimulationContext';
import { useDemoSession } from '../../context/DemoSessionContext';
import { DEMO_ROLE, FALLBACK_INITIALS, FALLBACK_NAME, initialsFor, SIGN_IN_PATH } from '../../lib/demoSession';
import type { AppMode } from '../../lib/appModes';
import { formatClockTime, formatSimulationDate } from '../../lib/format';
import SeverityBadge from '../signals/SeverityBadge';
import { SIGNALS_QUEUE_PATH } from '../dashboard/AlertSummary';
import DataSourceIndicator from './DataSourceIndicator';
import ModeChip from './ModeChip';
import { usePortfolio } from '../../lib/profiles/usePortfolio';
import { PROFILE_BY_ID, RVS_PROFILE_ID } from '../../lib/profiles/registry';
import { STATUS_LABEL } from '../../lib/profiles/derive';
import { useLiveSurveillance } from '../../context/LiveSurveillanceContext';
import { useLiveClock } from '../live/LiveParts';

/**
 * The top bar: global context and global actions only. On analyst pages it
 * names the mode once, with its one simulated-data disclosure, then the Live
 * clock, or the replay day and its controls (the calendar is shared by every
 * profile); the SELECTED profile's name and severity on wider screens;
 * the alerts bell; and the analyst. On Scenario Replay itself
 * the reading is the replay's own profile, Respiratory Viral Activity, named
 * as such. A profile without a score shows its status in words, never
 * another profile's score. The bell counts and lists alerts across all
 * profiles and links to Signals; alerts are acknowledged on Signals, not here.
 * On System pages it names the page's mode instead, so a replay score is
 * never read as, say, a dynamic signal.
 */
export default function TopBar({ mode = 'classroom', onOpenNav }: { mode?: AppMode; onOpenNav: () => void }) {
  const classroom = mode === 'classroom';
  const {
    currentDay,
    simulationDate,
    signalScore,
    nextDay,
    previousDay,
    resetSimulation,
    refresh,
    lastUpdated,
    isFirstDay,
    isLastDay,
  } = useSimulation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const portfolio = usePortfolio();
  const live = useLiveSurveillance();
  const isLive = live.mode === 'live';
  const liveClock = useLiveClock();
  // The bell is global: every profile's alerts, in the active mode.
  const alerts = portfolio.alerts;
  const unacknowledgedCount = alerts.filter((a) => a.status !== 'Acknowledged').length;
  // Scenario Replay narrates Respiratory Viral Activity; elsewhere the reading follows ?profile=.
  const onReplay = !isLive && (pathname === '/replay' || pathname === '/simulation');
  const readingId = onReplay ? RVS_PROFILE_ID : portfolio.focusId;
  const reading = portfolio.summaries.find((s) => s.profile.id === readingId);
  const readingProfile = PROFILE_BY_ID[readingId];
  const readingScore = onReplay ? signalScore : (reading?.score ?? null);
  const readingStatus = onReplay ? null : (reading?.status ?? null);
  const readingStatusText = readingStatus === 'NO_DATA' ? 'No current data' : STATUS_LABEL[readingStatus ?? 'NO_DATA'];
  const readingAlerts = alerts.filter((a) => a.profileId === readingId && a.status !== 'Acknowledged').length;
  const readingLabel = `${onReplay ? 'Replay profile' : 'Selected profile'}: ${readingProfile.displayName}, ${
    readingScore ? readingScore.severity : readingStatusText.toLowerCase()
  }; ${readingAlerts} ${readingAlerts === 1 ? 'alert' : 'alerts'} awaiting acknowledgement`;
  const [showAlerts, setShowAlerts] = useState(false);
  const { session, signOut } = useDemoSession();
  // The guard means a session always exists here; the fallback only covers
  // the instant between Sign Out and the redirect.
  const displayName = session?.name ?? FALLBACK_NAME;
  const initials = session ? initialsFor(session.name) : FALLBACK_INITIALS;

  // Ends the sign-in session only: the replay day and its review state are left as they are.
  // Signing out returns to the sign-in screen, as before.
  const handleSignOut = () => {
    signOut();
    navigate(SIGN_IN_PATH, { replace: true });
  };

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-hairline bg-white px-4 py-3 lg:px-6 xl:flex-nowrap xl:gap-x-3">
      <button
        type="button"
        onClick={onOpenNav}
        className="ls-btn min-w-[34px] px-2.5 py-1.5 lg:hidden"
        aria-label="Open navigation"
      >
        ☰
      </button>

      {classroom && isLive ? (
        <>
          <div className="min-w-0">
            {/* The one statement that the live feeds are simulated; the link leads to the full limitations. */}
            <p className="text-[11px] font-semibold text-muted" data-testid="mode-disclosure">
              Live Surveillance ·{' '}
              <Link
                to="/overview#about-the-data"
                title="About the live simulation"
                className="underline decoration-dotted underline-offset-2 hover:text-brand"
              >
                Simulated source feeds<span className="sr-only"> — about the live simulation</span>
              </Link>
            </p>
            <p className="truncate text-sm font-semibold text-ink" data-testid="live-clock">
              {liveClock}
              <span className="ml-2 font-normal text-muted">live surveillance date</span>
            </p>
          </div>
          {/* The run state is the Dashboard's Live strip's, not the top bar's. */}
        </>
      ) : classroom ? (
        <>
          <div className="min-w-0">
            {/* The mode and the one statement that its data is simulated, in one line; the link leads to the full limitations. */}
            <p className="text-[11px] font-semibold text-muted" data-mode="classroom" data-testid="mode-disclosure">
              <span className="text-brand">Scenario Replay</span> ·{' '}
              <Link
                to="/overview#about-the-data"
                title="About replay data"
                className="underline decoration-dotted underline-offset-2 hover:text-brand"
              >
                Simulated surveillance data<span className="sr-only"> — about replay data</span>
              </Link>
            </p>
            {/* The replay day and date; the stage is the Scenario Replay page's own story context. */}
            <p
              className="truncate text-sm font-semibold text-ink"
              title={`Day ${currentDay} of 5 · ${formatSimulationDate(simulationDate)}`}
              data-testid="replay-day"
            >
              Day {currentDay} of 5
              <span className="ml-2 font-normal text-muted">
                {formatSimulationDate(simulationDate)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previousDay}
              disabled={isFirstDay}
              className="ls-btn min-w-[34px] px-2.5 py-1.5"
              aria-label="Previous replay day"
              title={isFirstDay ? 'Already at Day 1' : 'Previous day'}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={nextDay}
              disabled={isLastDay}
              className="ls-btn min-w-[34px] px-2.5 py-1.5"
              aria-label="Next replay day"
              title={isLastDay ? 'Already at Day 5' : 'Next day'}
            >
              ›
            </button>
            <button
              type="button"
              onClick={resetSimulation}
              className="ls-btn px-3 py-1.5"
              aria-label="Reset Scenario Replay to Day 1"
              title="Reset Scenario Replay to Day 1"
            >
              Reset
            </button>
          </div>
        </>
      ) : (
        <div className="flex min-w-0 items-center">
          <ModeChip mode={mode} withDescription />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {/* Local vs API is an implementation detail: shown on System pages only. */}
        {classroom ? null : <DataSourceIndicator />}


        {/* The browser session clock is not a data timestamp: shown on System pages only. */}
        {classroom ? null : (
          <div className="hidden text-right md:block">
            <p className="ls-label">Session updated</p>
            <button
              type="button"
              onClick={refresh}
              className="-my-1.5 inline-flex items-center py-1.5 text-sm font-medium text-brand hover:underline"
              title="Refresh the session timestamp (real time, not scenario time)"
            >
              {formatClockTime(lastUpdated)}
            </button>
          </div>
        )}

        {classroom ? (
          <div
            className="hidden items-center gap-2 sm:flex"
            role="group"
            aria-label={readingLabel}
            title={readingLabel}
            data-testid="profile-reading"
          >
            <span aria-hidden="true" className="max-w-[9rem] truncate text-sm font-semibold text-ink">
              {readingProfile.shortName}
            </span>
            {/* Severity only: the score itself is on the page (Dashboard, Current State, alerts). */}
            {readingScore ? (
              <span aria-hidden="true">
                <SeverityBadge severity={readingScore.severity} />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="whitespace-nowrap rounded-full border border-dashed border-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted"
              >
                {readingStatusText}
              </span>
            )}
          </div>
        ) : null}

        {/* On phones the list spans the top bar's width (anchored to the header), so it never runs off screen. */}
        <div
          className="sm:relative"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowAlerts(false);
          }}
        >
          <button
            type="button"
            onClick={() => setShowAlerts((open) => !open)}
            className="ls-btn relative min-w-[34px] px-2.5 py-1.5"
            aria-label={`Notifications: ${unacknowledgedCount} ${
              unacknowledgedCount === 1 ? 'alert' : 'alerts'
            } awaiting acknowledgement across all profiles`}
            aria-expanded={showAlerts}
          >
            <span aria-hidden="true">🔔</span>
            {unacknowledgedCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-severity-critical px-1 text-[10px] font-bold text-white">
                {unacknowledgedCount}
              </span>
            ) : null}
          </button>

          {showAlerts ? (
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowAlerts(false)}
              />
              {/* A notification list, not an action surface: alerts are acknowledged on Signals. */}
              <div
                className="absolute inset-x-4 top-full z-50 mt-1 rounded-xl border border-hairline bg-white p-2 shadow-panel sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80"
                data-testid="alerts-menu"
              >
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {unacknowledgedCount} awaiting acknowledgement · all profiles
                </p>
                {alerts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">
                    No alerts detected yet.
                  </p>
                ) : (
                  <ul className="max-h-80 space-y-1 overflow-y-auto">
                    {alerts.map((alert) => (
                      <li key={alert.id}>
                        <Link
                          to={`/signals?profile=${encodeURIComponent(alert.profileId)}`}
                          onClick={() => setShowAlerts(false)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-canvas"
                        >
                          <span className="mt-0.5">
                            <SeverityBadge severity={alert.detection.severity} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-snug text-ink">
                              {PROFILE_BY_ID[alert.profileId].displayName} — {alert.title}
                            </span>
                            <span className="block text-xs text-muted">
                              detected {portfolio.period.label(alert.detectedDay)} ·{' '}
                              {alert.status === 'Acknowledged' ? 'acknowledged' : 'awaiting acknowledgement'}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 border-t border-hairline px-2 pb-1 pt-2">
                  <Link
                    to={SIGNALS_QUEUE_PATH}
                    onClick={() => setShowAlerts(false)}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Review alerts in Signals <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-l border-hairline pl-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand"
          >
            {initials}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="max-w-[11rem] truncate text-sm font-medium text-ink" title={displayName}>
              {displayName}
            </p>
            <p className="whitespace-nowrap text-[11px] text-muted">{session?.role ?? DEMO_ROLE}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="ls-btn ml-1 shrink-0 whitespace-nowrap px-2.5 py-1.5 text-xs"
            aria-label={`Sign Out ${displayName}`}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
