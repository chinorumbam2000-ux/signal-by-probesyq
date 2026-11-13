import { Link, useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import KpiCard, { type KpiChange } from '../components/dashboard/KpiCard';
import TrendChart from '../components/dashboard/TrendChart';
import SectionHeading from '../components/dashboard/SectionHeading';
import CurrentSituationCard from '../components/dashboard/CurrentSituationCard';
import HighestRiskArea from '../components/dashboard/HighestRiskArea';
import AlertSummary from '../components/dashboard/AlertSummary';
import ScoreMovement from '../components/dashboard/ScoreMovement';
import OutbreakMap from '../components/map/OutbreakMap';
import MapLegend from '../components/map/MapLegend';
import Card from '../components/common/Card';
import PageMeta from '../components/common/PageMeta';
import { PrivacyNote } from '../components/common/PrivacyValue';
import { ErrorState, LoadingState } from '../components/common/States';
import { formatPercent, formatPercentagePoints, formatSignedPercent } from '../lib/format';
import { usePortfolio } from '../lib/profiles/usePortfolio';
import ProfileSelector from '../components/profiles/ProfileSelector';
import ActiveSurveillance from '../components/profiles/ActiveSurveillance';
import ProfileHeading from '../components/profiles/ProfileHeading';
import { LiveStatusLine } from '../components/live/LiveParts';
import StartHere from '../components/dashboard/StartHere';

/**
 * The Public Health Dashboard: a concise overview for deciding what needs
 * attention. It reads top to bottom as
 *
 *   Start here · profile selector · Live status line · Active Surveillance
 *   · the selected profile · its score and Data Confidence · key indicators
 *   (with the change since the previous day, why the score moved, one small
 *   trend) · geographic summary · the highest-priority alert.
 *
 * It summarises; the full pages own the detail. Signals owns the alert queue
 * and its actions, Facilities the five Data Confidence inputs and feed health,
 * Analytics the trend exploration, Live Surveillance its sources.
 *
 * The selected profile comes from ?profile= (Respiratory Viral Activity by
 * default). A profile with no data or no usable baseline shows why it has no
 * score instead of a score.
 */
export default function DashboardPage() {
  const { isLoading, error, clearError } = useSimulation();

  const portfolio = usePortfolio();
  const { view, period } = portfolio;
  // The period on screen: the replay day, or Live Surveillance's latest closed day.
  const isLive = period.mode === 'live';
  const currentDay = period.day;
  const { scenario: currentScenario, score: signalScore, zipMetrics, baseline } = view;
  const profileParam = encodeURIComponent(view.profile.id);
  const mapPath = `/map?profile=${profileParam}`;
  const navigate = useNavigate();

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={clearError} />
      </Card>
    );
  }

  // The change since the previous day, from the engine's own day-over-day
  // comparison (small-count rule already applied), shown on each indicator.
  const comparison = view.display.dayOverDay;
  const since =
    comparison?.available && comparison.previousDay !== null ? period.label(comparison.previousDay) : null;
  const changeOf = (metricLabel: string): KpiChange | null => {
    if (!comparison?.available || !since) return null;
    const metric = comparison.metrics.find((m) => m.label === metricLabel);
    if (!metric) return null;
    return metric.delta.startsWith('Withheld')
      ? { delta: metric.delta, direction: 'none', since, withheld: true }
      : { delta: metric.delta, direction: metric.direction, since };
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Regional Outbreak Status
          </h1>
          <p className="mt-1 text-sm text-muted">
            {view.profile.displayName} | Worcester County, MA
          </p>
        </div>
        <PageMeta />
      </header>

      <StartHere />

      <ProfileSelector portfolio={portfolio} />

      {isLoading ? (
        <Card>
          <LoadingState />
        </Card>
      ) : (
        <>
          {isLive ? (
            // Summary only: the feed is operated, and its sources detailed, on the Live Surveillance page.
            <section aria-label="Live feeds" data-testid="dashboard-live">
              <LiveStatusLine />
            </section>
          ) : null}

          <ActiveSurveillance portfolio={portfolio} day={currentDay} />

          {/* The score sentence and its breakdown are left to the score section below. */}
          <ProfileHeading view={view} showScore={false} />

          {/* ============ OUTBREAK SCORE + DATA CONFIDENCE ============ */}
          <section aria-labelledby="section-situation" className="space-y-3">
            <SectionHeading
              id="section-situation"
              title={signalScore ? 'Outbreak score and data confidence' : 'Data confidence'}
              subtitle={
                signalScore
                  ? 'Two separate readings: how concerning the signal is, and how far the data behind it can be trusted'
                  : 'Source-wide: the same for every profile'
              }
            />
            <CurrentSituationCard
              score={signalScore}
              confidence={period.dataConfidence}
              facilitiesPath={`/facilities?profile=${profileParam}`}
            />
          </section>

          {signalScore ? (
          <>
          {/* ============ KEY INDICATORS ============ */}
          <section aria-labelledby="section-indicators" className="space-y-3">
            <SectionHeading
              id="section-indicators"
              title="Key indicators"
              subtitle={
                isLive
                  ? 'The latest closed day against the rolling 7-day baseline, with the change since the previous day'
                  : 'The replay day against the Day 1 baseline, with the change since the previous day'
              }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Tests"
                value={currentScenario.totalTests.toLocaleString('en-US')}
                change={changeOf('Tests')}
                footnote={`${formatSignedPercent(signalScore.volumeIncreasePercent, 0)} vs baseline ${baseline.tests}`}
              />
              <KpiCard
                label="Positivity"
                value={view.display.regional.suppressed ? view.display.positivity : formatPercent(currentScenario.positivityRate)}
                change={changeOf('Positivity')}
                footnote={
                  view.display.ratesWithheld
                    ? `Baseline ${view.display.baselinePositivity} · change withheld (fewer than 5 positives)`
                    : `${formatPercentagePoints(signalScore.positivityDeltaPoints)} vs baseline ${view.display.baselinePositivity}`
                }
              />
              <KpiCard
                label="Affected Facilities"
                value={`${currentScenario.affectedHospitals.length} / 3`}
                change={changeOf('Affected facilities')}
                footnote={
                  currentScenario.affectedHospitals.length === 0
                    ? 'No facility above the detection margin'
                    : currentScenario.affectedHospitals.join(', ')
                }
              />
              <KpiCard
                label="Affected Areas"
                value={`${currentScenario.affectedZipCodes.length} / 3`}
                change={changeOf('Affected geographic areas')}
                footnote={
                  currentScenario.affectedZipCodes.length === 0
                    ? 'No surveillance area affected'
                    : `${currentScenario.affectedZipCodes.join(', ')} affected`
                }
              />
              <KpiCard
                label="Persistence"
                value={`${currentScenario.persistenceDays} ${
                  currentScenario.persistenceDays === 1 ? 'day' : 'days'
                }`}
                change={changeOf('Persistence')}
                footnote={
                  currentScenario.persistenceDays === 0
                    ? 'Positivity at or below baseline'
                    : 'Consecutive days above baseline'
                }
              />
            </div>

            {comparison ? <ScoreMovement comparison={comparison} /> : null}

            <Card
              title="Test Volume &amp; Positivity Trend"
              subtitle={
                isLive ? 'Closed days · synthetic aggregate data' : `Day 1 to Day ${currentDay} · synthetic aggregate data`
              }
              bodyClassName="p-4"
            >
              <TrendChart data={view.display.trendSeries} />
            </Card>
          </section>

          {/* ============ GEOGRAPHIC SUMMARY ============ */}
          <section aria-labelledby="section-geography" className="space-y-3">
            <SectionHeading
              id="section-geography"
              title="Geographic summary"
              subtitle="Synthetic surveillance areas, with small counts suppressed"
            />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <Card className="xl:col-span-2" bodyClassName="p-0">
                <div className="relative h-[320px] w-full overflow-hidden rounded-t-xl">
                  <OutbreakMap
                    zipMetrics={zipMetrics}
                    selectedZip={null}
                    onSelectZip={() => navigate(mapPath)}
                    resetToken={0}
                    interactive={false}
                    showLabels={false}
                    privacy={view.privacy}
                  />
                  <div className="pointer-events-none absolute left-3 top-3 z-[1100]">
                    <MapLegend compact />
                  </div>
                </div>
                {/* A fixed summary (no pan or zoom, so nothing to reset); the Outbreak Map is the place to explore.
                    The map's own attribution already says it is a synthetic, demonstration-only overlay. */}
                <div className="flex justify-end border-t border-hairline px-4 py-3">
                  <Link to={mapPath} className="ls-btn shrink-0 px-2.5 py-1 text-[11px]" data-testid="open-map-link">
                    Open Outbreak Map <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </Card>

              <HighestRiskArea
                zipMetrics={zipMetrics}
                currentDay={currentDay}
                privacy={view.privacy}
              />
            </div>
          </section>
          </>
          ) : null}

          {/* ============ HIGHEST-PRIORITY ALERT ============ */}
          <section aria-labelledby="section-alert" className="space-y-3">
            <SectionHeading
              id="section-alert"
              title="Highest-priority alert"
              subtitle="Across every profile. Alerts are reviewed, acknowledged and investigated on the Signals page."
            />
            <AlertSummary alerts={portfolio.alerts} />
          </section>

          <PrivacyNote className="px-1 pb-2" />
        </>
      )}
    </div>
  );
}
