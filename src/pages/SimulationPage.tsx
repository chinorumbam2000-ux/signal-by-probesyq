import { useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { useLiveSurveillance } from '../context/LiveSurveillanceContext';
import Card from '../components/common/Card';
import DayOverDayChange from '../components/common/DayOverDayChange';
import { ErrorState } from '../components/common/States';
import SeverityBadge from '../components/signals/SeverityBadge';
import { SEVERITY_STYLES } from '../lib/format';
import { SCORE_DISCLAIMER_TEXT, withProductName } from '../lib/brand';
import MethodNote from '../components/common/MethodNote';
import { PROFILE_BY_ID, RVS_PROFILE_ID } from '../lib/profiles/registry';

/**
 * Scenario Replay (/replay): the historical training scenario. A known
 * five-day progression of Respiratory Viral Activity, stepped through to see
 * how the signal develops and how it is scored.
 *
 * Each piece of context has one home. The top bar carries the replay day and
 * date with the previous / next / Reset controls (on every Replay-scoped
 * page); this page carries the story: the five-day timeline (jump to any
 * day), Auto Play, the selected day's stage and narrative, Current State (the
 * one detailed snapshot, with the score), what changed since the previous
 * day, and the whole progression in one concise table.
 */
export default function SimulationPage() {
  // This page is the Scenario Replay: visiting it switches the app to replay mode.
  const { setMode } = useLiveSurveillance();
  useEffect(() => setMode('replay'), [setMode]);
  const {
    currentDay,
    currentScenario,
    signalScore,
    dataConfidence,
    dayOverDay,
    isPlaying,
    isLastDay,
    error,
    clearError,
    goToDay,
    playSimulation,
    pauseSimulation,
    surveillanceDays,
    scoreForDay,
  } = useSimulation();
  const scenarios = surveillanceDays.map((item) => item.scenario);
  const profileName = PROFILE_BY_ID[RVS_PROFILE_ID].displayName;

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={clearError} />
      </Card>
    );
  }

  const styles = SEVERITY_STYLES[signalScore.severity];

  const state = [
    { label: 'Tests', value: currentScenario.totalTests.toLocaleString('en-US') },
    { label: 'Positives', value: currentScenario.totalPositives.toLocaleString('en-US') },
    { label: 'Positivity', value: `${currentScenario.positivityRate.toFixed(1)}%` },
    { label: 'Affected Facilities', value: `${currentScenario.affectedHospitals.length} / 3` },
    { label: 'Affected Areas', value: `${currentScenario.affectedZipCodes.length} / 3` },
    {
      label: 'Persistence',
      value: `${currentScenario.persistenceDays} ${currentScenario.persistenceDays === 1 ? 'day' : 'days'}`,
    },
    { label: 'Data Confidence', value: `${dataConfidence.score} / 100 · ${dataConfidence.level}` },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Scenario Replay</h1>
        <p className="mt-0.5 text-sm font-medium text-brand" data-testid="replay-subtitle">
          Historical training scenario
        </p>
        <p className="mt-1 max-w-3xl text-sm text-muted" data-testid="replay-intro">
          A controlled, known five-day sequence showing how {profileName} — the aggregate respiratory profile — develops
          across three fictional facilities, on synthetic data. Live Surveillance is the operational mode; the replay
          day chosen here (or with the top bar) is the one every analyst page shows.
        </p>
      </header>

      {/* The story of the selected day, and the whole sequence to move through it. */}
      <section
        aria-labelledby="replay-story-title"
        className={`ls-card overflow-hidden border ${styles.soft}`}
        data-testid="replay-story"
      >
        <span aria-hidden="true" className={`block h-1 w-full ${styles.accent}`} />
        <div className="p-5 sm:p-6">
          <p className="ls-label">Replay day</p>
          <h2 id="replay-story-title" className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Day {currentDay} <span className="text-muted">of 5</span>
            <span className="mt-1 block text-lg font-medium text-brand">{currentScenario.stage}</span>
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-ink">
            {withProductName(currentScenario.description)}
          </p>

          {/* The five-day timeline: the whole progression, and a way to jump to any day. */}
          <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5" aria-label="Five-day timeline" data-testid="replay-timeline">
            {scenarios.map((scenario) => {
              const isCurrent = scenario.day === currentDay;
              const isReached = scenario.day <= currentDay;
              const scenarioScore = scoreForDay(scenario.day);
              return (
                <li key={scenario.day}>
                  <button
                    type="button"
                    onClick={() => goToDay(scenario.day)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isCurrent
                        ? 'border-brand bg-white shadow-card'
                        : isReached
                          ? 'border-hairline bg-white/70 hover:bg-white'
                          : 'border-dashed border-hairline bg-transparent hover:bg-white/50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`block h-1 w-full rounded-full ${
                        isReached ? SEVERITY_STYLES[scenarioScore.severity].accent : 'bg-hairline'
                      }`}
                    />
                    {/* The visible text is the accessible name: "Day 2, Isolated Facility Signal, Score 24 · Watch". */}
                    <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Day {scenario.day}
                      <span className="sr-only">, </span>
                    </span>
                    <span className={`mt-0.5 block text-xs font-medium leading-snug ${isReached ? 'text-ink' : 'text-muted'}`}>
                      {scenario.stage}
                      <span className="sr-only">, </span>
                    </span>
                    <span className="mt-1 block text-[11px] tabular-nums text-muted">
                      {isReached ? `Score ${scenarioScore.composite} · ${scenarioScore.severity}` : 'Not yet reached'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* One stateful Auto Play control; day steps and Reset are in the top bar. */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={isPlaying ? pauseSimulation : playSimulation}
              aria-pressed={isPlaying}
              className="ls-btn"
              data-testid="replay-autoplay"
            >
              {isPlaying ? '❚❚ Pause Auto Play' : '▶ Auto Play'}
            </button>
            <span role="status" className="text-xs font-medium text-muted" data-testid="replay-autoplay-status">
              {isPlaying
                ? 'Auto-playing — advances every 3 seconds, stops at Day 5.'
                : isLastDay
                  ? 'Final day reached. Auto Play restarts from Day 1; Reset in the top bar returns there too.'
                  : 'Steps through the remaining days, one every 3 seconds.'}
            </span>
          </div>
        </div>
      </section>

      <Card title="Current State" subtitle="The selected replay day's figures">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="replay-current-state">
          <div>
            <p className="ls-label">Composite Outbreak Signal Score</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-3xl font-semibold tabular-nums text-ink">
                {signalScore.composite}
                <span className="text-lg font-medium text-muted"> / 100</span>
              </span>
              <SeverityBadge severity={signalScore.severity} size="md" />
            </p>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {state.map((item) => (
              <div key={item.label} className="rounded-lg bg-canvas p-3">
                <dt className="ls-label">{item.label}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <DayOverDayChange comparison={dayOverDay} concise />

      <Card
        title="How the outbreak develops"
        subtitle="The whole five-day progression"
        bodyClassName="p-0"
      >
        <div className="w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Five-day progression table">
          <table className="w-full min-w-[620px] border-collapse">
            <caption className="sr-only">
              The five-day progression of {profileName}: stage, tests, positivity, affected facilities and areas, and score
            </caption>
            <thead className="border-b border-hairline bg-canvas">
              <tr>
                <th scope="col" className="ls-th">Day</th>
                <th scope="col" className="ls-th">Stage</th>
                <th scope="col" className="ls-th text-right">Tests</th>
                <th scope="col" className="ls-th text-right">Positivity</th>
                <th scope="col" className="ls-th text-right">Facilities · Areas</th>
                <th scope="col" className="ls-th">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {scenarios.map((scenario) => {
                const isReached = scenario.day <= currentDay;
                const isCurrent = scenario.day === currentDay;
                const scenarioScore = scoreForDay(scenario.day);
                return (
                  <tr
                    key={scenario.day}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`${isCurrent ? 'bg-brand-light' : ''} ${isReached ? '' : 'text-muted'}`}
                    data-testid="progression-row"
                  >
                    <th scope="row" className="ls-td text-left font-semibold">Day {scenario.day}</th>
                    <td className="ls-td">{scenario.stage}</td>
                    <td className="ls-td text-right tabular-nums">{isReached ? scenario.totalTests : '—'}</td>
                    <td className="ls-td text-right tabular-nums">
                      {isReached ? `${scenario.positivityRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="ls-td text-right tabular-nums">
                      {isReached ? `${scenario.affectedHospitals.length} · ${scenario.affectedZipCodes.length}` : '—'}
                    </td>
                    <td className="ls-td">
                      {isReached ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-semibold tabular-nums">{scenarioScore.composite}</span>
                          <SeverityBadge severity={scenarioScore.severity} />
                        </span>
                      ) : (
                        <span className="text-xs">Not yet reached</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-hairline px-4 py-3">
          <MethodNote>{SCORE_DISCLAIMER_TEXT}</MethodNote>
        </div>
      </Card>
    </div>
  );
}
