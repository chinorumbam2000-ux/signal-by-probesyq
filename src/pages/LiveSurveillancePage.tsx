import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageMeta from '../components/common/PageMeta';
import { useLiveSurveillance } from '../context/LiveSurveillanceContext';
import {
  ActivityStream,
  InjectObservation,
  LiveControls,
  SourceStatusPanel,
  TodaySoFar,
} from '../components/live/LiveParts';
import { HISTORY_DATES } from '../lib/live/dataset';
import { settingsFor, RVS_PROFILE_ID } from '../lib/profiles/registry';
import { withProfileParam } from '../lib/profiles/selection';

/**
 * Live Surveillance: synthetic observations arriving through three simulated
 * source feeds, processed in the browser — the same pipeline and engine
 * rules as the backend, without needing it.
 */
export default function LiveSurveillancePage() {
  const { setMode } = useLiveSurveillance();
  const { search } = useLocation();
  // This page is the live simulation.
  useEffect(() => setMode('live'), [setMode]);
  const reference = settingsFor(RVS_PROFILE_ID).ewma.referenceDays;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Live Surveillance</h1>
          <p className="mt-0.5 text-sm font-medium text-brand" data-testid="live-subtitle">
            Current simulated feed
          </p>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Laboratory observations arrive through three source feeds and are validated, normalized, routed to every
            applicable profile and scored as they arrive.
          </p>
        </div>
        <PageMeta />
      </header>

      <div className="ls-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <LiveControls />
        <Link to={withProfileParam('/dashboard', search)} className="ls-btn px-3 py-1.5 text-sm">
          Open the dashboard →
        </Link>
      </div>

      <TodaySoFar />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-3">
          <SourceStatusPanel />
          <InjectObservation />
          {/* How it works, briefly; the technical detail lives under System. */}
          <details className="ls-card px-4 py-3" data-testid="live-how-it-works">
            <summary className="cursor-pointer text-sm font-semibold text-ink">How this works</summary>
            <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink" aria-label="From observation to signal">
              {['Observation', 'Normalization', 'Profile routing', 'Surveillance calculation', 'Signal update'].map((step, index) => (
                <li key={step} className="flex items-center gap-1.5">
                  {index > 0 ? <span aria-hidden="true" className="text-muted">→</span> : null}
                  <span className="rounded-full bg-canvas px-2 py-0.5 font-medium">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted" data-testid="live-statistics">
              Statistical confirmation (EWMA, CUSUM) needs a {reference}-day reference history; this feed holds{' '}
              {HISTORY_DATES.length} days, so none is shown or invented.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <Link to="/dynamic-surveillance" className="font-semibold text-brand hover:underline">
                View Detection Methods <span aria-hidden="true">→</span>
              </Link>
              <Link to="/architecture" className="font-semibold text-brand hover:underline">
                Architecture <span aria-hidden="true">→</span>
              </Link>
            </p>
          </details>
        </div>
        <div className="xl:col-span-2">
          <ActivityStream />
        </div>
      </div>
    </div>
  );
}
