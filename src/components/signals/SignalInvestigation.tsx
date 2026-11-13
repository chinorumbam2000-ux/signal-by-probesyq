import type {
  DayOverDayComparison,
  InvestigationAction,
  InvestigationRecord,
  OutbreakAlert,
  SimulationDay,
} from '../../types';
import { SIGNAL_DISCLAIMER } from '../../lib/signalScore';
import { SCORE_DISCLAIMER_TEXT } from '../../lib/brand';
import { SEVERITY_STYLES, formatSimulationDate, formatSimulationDateTime } from '../../lib/format';
import { useSimulation } from '../../context/SimulationContext';
import { dataConfidenceFor, findDay } from '../../lib/surveillanceDays';
import { getAllFeedHealth } from '../../data/feedHealth';
import SeverityBadge from './SeverityBadge';
import WhyThisSignalPanel from './WhyThisSignalPanel';
import DataConfidenceCard from '../common/DataConfidenceCard';
import FeedHealthCard from '../common/FeedHealthCard';
import DayOverDayChange from '../common/DayOverDayChange';
import InvestigationWorkflowPanel from './InvestigationWorkflowPanel';
import MethodNote from '../common/MethodNote';
import ProfileTypeTag from '../profiles/ProfileTypeTag';
import { PROFILE_BY_ID, RVS_PROFILE_ID } from '../../lib/profiles/registry';

export type InvestigationMode = 'detection' | 'current';

interface SignalInvestigationProps {
  /** The alert being investigated, if the user came from a specific alert. */
  alert?: OutbreakAlert;
  /** The globally selected simulation day. Never changed by this component. */
  currentDay: SimulationDay;
  mode: InvestigationMode;
  onModeChange: (mode: InvestigationMode) => void;
  onBack: () => void;
  /** The change since the previous day, for the current-conditions view. */
  dayOverDay: DayOverDayComparison;
  /** Human review state; absent when investigating current conditions only. */
  investigation?: InvestigationRecord;
  onInvestigationAction?: (action: InvestigationAction, note?: string) => string | null;
  onPrepareReport?: () => void;
  hasReport?: boolean;
}

/**
 * The investigation of a Respiratory Viral Activity signal.
 *
 * Which day is explained depends on the view:
 *   - "detection" (the default) replays the day the alert actually fired
 *   - "current"   explains the globally selected simulation day
 *
 * Everything on screen describes that one day: the score and its single
 * component breakdown, why the signal fired, and the Data Confidence and feed
 * health of that day. Both views are computed through the same shared scorer
 * over the same authoritative dataset, so neither duplicates the formula and
 * no score is hard-coded. Switching views changes nothing global — not the
 * simulation day, not acknowledgements, not the stored alert history.
 */
export default function SignalInvestigation({
  alert,
  currentDay,
  mode,
  onModeChange,
  onBack,
  dayOverDay,
  investigation,
  onInvestigationAction,
  onPrepareReport,
  hasReport = false,
}: SignalInvestigationProps) {
  // Without an alert there is nothing historical to replay, so the only
  // meaningful view is current conditions.
  const effectiveMode: InvestigationMode = alert ? mode : 'current';
  const day: SimulationDay = effectiveMode === 'detection' && alert
    ? alert.detectedDay
    : currentDay;

  // The active data source's day, in both views: at detection and now.
  const { surveillanceDays, scoreForDay } = useSimulation();
  const surveillanceDay = findDay(surveillanceDays, day);
  const scenario = surveillanceDay.scenario;
  const score = scoreForDay(day);
  // Data Confidence and feed health of the same day as the score, never of another.
  const confidence = dataConfidenceFor(surveillanceDay);
  const feeds = getAllFeedHealth(day);
  const totalPoints = score.components.reduce(
    (sum, component) => sum + component.points,
    0,
  );

  const isDetection = effectiveMode === 'detection' && Boolean(alert);
  const when = isDetection ? 'at detection' : 'now';

  // In detection mode the headline reports the alert's own recorded severity
  // and score. For the regional signal these equal the recomputed values (a
  // unit test pins that); for kind-scoped alerts the recorded severity is the
  // alert's own classification rather than the composite band.
  const headlineScore =
    isDetection && alert ? alert.detection.compositeScore : score.composite;
  const headlineSeverity =
    isDetection && alert ? alert.detection.severity : score.severity;
  const styles = SEVERITY_STYLES[headlineSeverity];
  const sameDay = alert ? alert.detectedDay === currentDay : true;
  const profile = PROFILE_BY_ID[RVS_PROFILE_ID];
  const dayLabel = `Day ${day} · ${formatSimulationDate(scenario.simulationDate)}`;

  return (
    <div className="space-y-5" data-testid="signal-investigation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="ls-btn px-3 py-1.5 text-xs">
          ← Back to investigations
        </button>

        {alert ? (
          <div
            role="group"
            aria-label="Investigation view"
            className="flex w-full gap-1.5 rounded-lg border border-hairline bg-white p-1 shadow-card sm:w-auto"
          >
            <button
              type="button"
              onClick={() => onModeChange('detection')}
              aria-pressed={isDetection}
              className={`flex min-h-[32px] flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                isDetection
                  ? 'bg-brand text-white'
                  : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              At detection — Day {alert.detectedDay}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('current')}
              aria-pressed={!isDetection}
              className={`flex min-h-[32px] flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${
                !isDetection
                  ? 'bg-brand text-white'
                  : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              Current conditions — Day {currentDay}
            </button>
          </div>
        ) : null}
      </div>

      {/* The alert, and which day is on screen and why — stated before any numbers. */}
      <section
        className={`ls-card overflow-hidden border ${styles.soft}`}
        aria-label={alert ? `${profile.displayName} — ${alert.title}, ${when}` : `${profile.displayName}, current conditions`}
        data-testid="investigation-identity"
      >
        <span aria-hidden="true" className={`block h-1 w-full ${styles.accent}`} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
              {profile.displayName} <ProfileTypeTag profile={profile} />
            </p>
            <p className="mt-1 text-sm text-muted">
              Worcester County, MA
              {alert ? <> · detected {formatSimulationDateTime(alert.detectedAt)} (Day {alert.detectedDay})</> : null}
            </p>
            {alert ? (
              <p className="mt-1 text-sm text-muted">
                {alert.detection.detail.startsWith('Composite Score') ? null : <>{alert.detection.detail} · </>}
                {alert.detection.geography} · {alert.detection.facilities}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="ls-label">{isDetection ? 'Score at detection' : 'Score now'}</p>
            <div className="mt-1 flex items-center justify-end gap-2">
              <SeverityBadge severity={headlineSeverity} size="md" />
              <span className="text-2xl font-semibold tabular-nums text-ink">
                {headlineScore}
                <span className="text-base font-medium text-muted">/100</span>
              </span>
            </div>
          </div>
        </div>
        <div className={`border-t px-5 py-3 ${isDetection ? 'border-brand/20 bg-brand-light' : 'border-hairline bg-white'}`}>
          <p className="text-sm font-semibold text-ink" data-testid="investigation-day">
            {isDetection ? `At detection — ${dayLabel}` : `Current conditions — ${dayLabel}`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {isDetection && alert ? (
              <>
                Every value below was recorded when &ldquo;{alert.title}&rdquo; triggered: a frozen snapshot that
                does not change as the replay advances.
                {!sameDay ? (
                  <>
                    {' '}
                    The replay is now on Day {currentDay}; choose{' '}
                    <span className="font-medium text-ink">Current conditions</span> to see where the signal stands
                    now.
                  </>
                ) : (
                  ' It was detected on the selected replay day, so both views describe the same day.'
                )}
              </>
            ) : (
              <>
                Every value below is for the selected replay day
                {alert ? <> — not the values recorded when &ldquo;{alert.title}&rdquo; triggered on Day {alert.detectedDay}</> : null}
                . Changing the replay day changes this view.
              </>
            )}
          </p>
        </div>
      </section>

      {/* The one score breakdown: each component's points, then the total. */}
      <section className="ls-card" aria-labelledby="score-breakdown-heading" data-testid="score-breakdown">
        <header className="ls-card-header">
          <h2 id="score-breakdown-heading" className="ls-card-title">
            {isDetection ? 'Score at detection' : 'Score now'}: how the {score.composite} is made up
          </h2>
          <span className="ls-label">{isDetection ? `Day ${day} — at detection` : `Day ${day} — current`}</span>
        </header>
        <ul className="divide-y divide-hairline">
          {score.components.map((component) => (
            <li key={component.key} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{component.label}</p>
                <p className="text-sm font-semibold tabular-nums text-ink">
                  {component.points}
                  <span className="text-muted"> / {component.maxPoints}</span>
                </p>
              </div>
              <p className="mt-1 text-sm text-muted">{component.evidence}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${Math.max(component.score, 0)}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-muted">
                  {component.score.toFixed(0)}/100 × {Math.round(component.weight * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between gap-2 border-t-2 border-ink/20 px-5 py-3">
          <p className="text-sm font-semibold text-ink">Composite Outbreak Signal Score</p>
          <p className="text-sm font-semibold tabular-nums text-ink">{score.composite} / 100</p>
        </div>
        {totalPoints !== score.composite ? (
          <p className="px-5 pb-3 text-[11px] leading-snug text-muted">
            Component points are rounded for display, so they may differ from the composite total by one point. The
            composite is calculated from the unrounded weighted sum.
          </p>
        ) : null}
      </section>

      {/*
        Human review belongs to the alert, not to a particular view of it, so
        it shows in both detection and current views.
      */}
      {investigation && onInvestigationAction ? (
        <InvestigationWorkflowPanel
          record={investigation}
          onAction={onInvestigationAction}
          onPrepareReport={onPrepareReport ?? (() => {})}
          hasReport={hasReport}
        />
      ) : null}

      {/* The interpretation, without repeating the score or the Data Confidence shown here. */}
      <WhyThisSignalPanel
        scenario={scenario}
        score={score}
        confidence={confidence}
        feeds={feeds}
        showHeadlineScore={false}
        showCalculation={false}
        showDataTrust={false}
        compact
      />

      <section aria-labelledby="data-confidence-heading" className="space-y-3" data-testid="investigation-confidence">
        <div>
          <h2 id="data-confidence-heading" className="text-sm font-semibold text-ink">
            {isDetection ? 'Data Confidence at detection' : 'Data Confidence now'} — {dayLabel}
          </h2>
          <p className="text-xs text-muted">
            How far the participating sources could be trusted on that day. It never changes the outbreak score.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <DataConfidenceCard confidence={confidence} />
          <FeedHealthCard feeds={feeds} className="xl:col-span-2" />
        </div>
      </section>

      {/*
        Day-over-day always describes the globally selected day, so it is only
        shown in the current view — pairing it with a frozen detection-time
        breakdown would mix two different days on one screen.
      */}
      {!isDetection ? <DayOverDayChange comparison={dayOverDay} /> : null}

      <div className="ls-card border-l-4 border-l-severity-critical p-5">
        <p className="text-sm font-semibold text-ink">{SIGNAL_DISCLAIMER}</p>
        <MethodNote className="mt-2">{SCORE_DISCLAIMER_TEXT}</MethodNote>
      </div>
    </div>
  );
}
