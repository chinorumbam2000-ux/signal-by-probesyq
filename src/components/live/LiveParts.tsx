import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { HospitalId } from '../../types';
import { HOSPITALS } from '../../data/hospitals';
import { SPEEDS, useLiveSurveillance, type Speed, type SurveillanceMode } from '../../context/LiveSurveillanceContext';
import { ALL_DATES, SOURCE_TYPE, TEST_NAMES, type LiveTestCode } from '../../lib/live/dataset';
import { clock } from '../../lib/live/sources';
import { END_MINUTE, LIVE_PROFILES, dayAndMinuteOf, shortFacilityName, type AuditEntry } from '../../lib/live/simulator';
import { liveDayLabel, liveProvisional } from '../../lib/live/view';
import { PROFILE_BY_ID, RVS_PROFILE_ID, settingsFor } from '../../lib/profiles/registry';
import { HISTORY_DATES } from '../../lib/live/dataset';
import SeverityBadge from '../signals/SeverityBadge';
import ExpandableCard from '../common/ExpandableCard';

/* ------------------------------------------------------------------------ */

/** "Feb 13 · 10:40" — the simulated clock. */
export function useLiveClock(): string {
  const { simulator } = useLiveSurveillance();
  const { dayIndex, minute } = dayAndMinuteOf(simulator.op);
  return `${liveDayLabel(dayIndex)} · ${clock(minute)}`;
}

/** What each context is: each selector button's description. */
export const MODE_DESCRIPTION: Record<SurveillanceMode, string> = {
  live: 'Simulated source feeds',
  replay: 'Historical training scenario',
};


/**
 * The Dashboard's surveillance context: Live Surveillance (the default) or
 * Scenario Replay (the historical training scenario). The selected context is
 * shown by aria-pressed and the filled button, and said in words by the
 * Dashboard's context strip below it. Choosing a context never starts the
 * live simulation. From the Scenario Replay page, choosing Live Surveillance
 * returns to the Dashboard.
 */
export function ModeSwitch() {
  const { mode, setMode } = useLiveSurveillance();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const choose = (next: SurveillanceMode) => {
    setMode(next);
    if (next === 'live' && (pathname === '/replay' || pathname === '/simulation')) navigate(`/dashboard${search}`);
  };
  return (
    <div
      role="group"
      aria-label="Surveillance context"
      className="inline-flex gap-0.5 rounded-lg border border-hairline bg-white p-0.5"
      data-testid="context-selector"
    >
      {(['live', 'replay'] as SurveillanceMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => choose(m)}
          title={MODE_DESCRIPTION[m]}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
            mode === m ? 'bg-brand font-semibold text-white' : 'font-medium text-muted hover:bg-canvas hover:text-ink'
          }`}
        >
          {m === 'live' ? 'Live Surveillance' : 'Scenario Replay'}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The playback speed: one compact button ("Speed: 1×") that opens the three
 * speeds. The open list is a group of pressed/unpressed buttons; choosing one
 * closes it and returns focus to the button, Escape closes it too, and the
 * new speed is announced. Arrow keys move between the speeds.
 */
export function SpeedSelector() {
  const { speed, setSpeed } = useLiveSurveillance();
  const [open, setOpen] = useState(false);
  const [announced, setAnnounced] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (s: Speed) => {
    setSpeed(s);
    setAnnounced(`Playback speed ${s}×`);
    close();
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        // Tabbing out of the selector closes it.
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="ls-btn px-3 py-1.5 text-sm"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        data-testid="speed-selector"
      >
        Speed: {speed}×
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        // A click anywhere outside closes the list (the same pattern as the top bar's notifications).
        <div aria-hidden="true" className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      ) : null}
      {open ? (
        <div
          ref={list}
          id={listId}
          role="group"
          aria-label="Playback speed"
          onKeyDown={onListKey}
          className="absolute right-0 top-full z-40 mt-1 flex w-28 flex-col gap-0.5 rounded-lg border border-hairline bg-white p-1 shadow-panel"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              // Opening moves focus to the selected speed.
              autoFocus={speed === s}
              onClick={() => choose(s)}
              className={`flex min-h-[36px] items-center justify-between rounded-md px-2.5 text-sm ${
                speed === s ? 'bg-brand-light font-semibold text-brand' : 'text-ink hover:bg-canvas'
              }`}
            >
              {s}×
              {speed === s ? <span aria-hidden="true" className="text-xs">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announced}
      </span>
    </div>
  );
}

/**
 * The live simulation's controls — the one place that starts it, in the
 * Dashboard's header in Live Surveillance: the one stateful action (Start,
 * Pause or Resume), Reset, and the compact speed selector.
 */
export function LiveControls() {
  const { simulator, playing, started, start, pause, resume, reset } = useLiveSurveillance();
  const finished = simulator.finished;
  const btn = 'ls-btn px-3 py-1.5 text-sm';
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Live simulation controls" data-testid="live-controls">
      {!started ? (
        <button type="button" className="ls-btn-primary px-3 py-1.5" onClick={start} data-testid="live-start">
          <span aria-hidden="true">▶ </span>Start Live Surveillance
        </button>
      ) : playing ? (
        <button type="button" className={btn} onClick={pause}>
          ❚❚ Pause
        </button>
      ) : (
        <button type="button" className={btn} onClick={resume} disabled={finished}>
          ▶ Resume
        </button>
      )}
      <button type="button" className={btn} onClick={reset}>
        ↺ Reset
      </button>
      <SpeedSelector />
    </div>
  );
}

/** How far through the live period the simulation is (or that it is complete). */
export function LiveProgress() {
  const { simulator } = useLiveSurveillance();
  const progress = Math.round((simulator.op / END_MINUTE) * 100);
  return (
    <span className="text-xs text-muted" aria-live="off" data-testid="live-progress">
      {simulator.finished ? 'Simulation complete' : `${progress}% of the ${ALL_DATES.length - 7}-day live period`}
    </span>
  );
}

/* ------------------------------------------------------------------------ */

const STATUS_STYLE: Record<string, string> = {
  HEALTHY: 'border-severity-low/40 bg-severity-low/5 text-[#166534]',
  DELAYED: 'border-severity-watch/50 bg-severity-watch/10 text-[#6B5102]',
  DEGRADED: 'border-severity-high/40 bg-severity-high/10 text-[#9A3412]',
  OFFLINE: 'border-severity-critical/40 bg-severity-critical/5 text-[#991B1B]',
};

const minutesText = (minutes: number | null) =>
  minutes === null ? 'none yet' : minutes < 1 ? 'just now' : `${minutes} min ago`;

type LiveRun = 'idle' | 'running' | 'paused' | 'complete';

/** The sources' state, from the live simulation (never a hard-coded "connected"). */
function useLiveRun() {
  const { simulator, started, playing } = useLiveSurveillance();
  const feeds = simulator.feedHealth();
  const active = feeds.filter((f) => f.isReporting && f.status !== 'DELAYED').length;
  // The feeds only send while the simulation runs: never "active" before Start or after the end.
  const run: LiveRun = simulator.finished ? 'complete' : !started ? 'idle' : playing ? 'running' : 'paused';
  return { simulator, feeds, active, run };
}

/** The simulator's feed note, without restating that the source is simulated (the panel heading says so). */
const feedNote = (note: string) => note.replace(/ (?:from|through) the simulated .+ source\.$/, '.');

const FEED_ISSUE: Record<string, string> = { DELAYED: 'delayed', DEGRADED: 'degraded', OFFLINE: 'offline' };

/**
 * One line about Live Surveillance: run state and an aggregate of the
 * sources, in words (never colour alone). The status half of the Dashboard's
 * Live Surveillance strip; its sources are detailed in "Source activity".
 */
export function LiveStatusLine({ bare = false }: { bare?: boolean }) {
  const { feeds, active, run } = useLiveRun();
  const parts: string[] = [];
  if (run === 'complete') parts.push('Complete');
  else if (run === 'idle') parts.push('Not started', `${feeds.filter((f) => f.isReporting).length} / ${feeds.length} sources ready`);
  else {
    parts.push(run === 'running' ? 'Running' : 'Paused', `${active} / ${feeds.length} sources active`);
    for (const f of feeds) {
      if (f.status !== 'HEALTHY') parts.push(`${shortFacilityName(f.hospitalId)} ${FEED_ISSUE[f.status] ?? f.status.toLowerCase()}`);
    }
  }
  return (
    <p role="status" className={`${bare ? '' : 'ls-card px-4 py-2.5 '}text-sm text-ink`} data-testid="dashboard-live-status" data-run-state={run}>
      {/* The app's usual " · " separator, as plain text: it reads and copies cleanly. */}
      <span className="font-semibold">Live Surveillance</span>
      {parts.map((part) => ` · ${part}`).join('')}
    </p>
  );
}

/** The three simulated sources in detail (the Dashboard's "Source activity"). */
export function SourceStatusPanel({ embedded = false }: { embedded?: boolean }) {
  const { simulator, feeds, active, run } = useLiveRun();
  const heading =
    run === 'idle'
      ? 'Sources · not started'
      : run === 'complete'
        ? 'Sources · live period complete'
        : run === 'paused'
          ? `Sources · paused (${active} / ${feeds.length} active when paused)`
          : `${active} / ${feeds.length} sources active`;
  const chip = (status: string) => {
    if (run === 'idle') return { text: 'Not started', style: 'border-hairline bg-canvas text-muted' };
    if (run === 'complete') return { text: 'Completed', style: 'border-hairline bg-canvas text-ink' };
    const label = status === 'HEALTHY' ? 'Active' : status === 'DELAYED' ? 'Delayed' : status === 'DEGRADED' ? 'Degraded' : 'Offline';
    if (run === 'paused') return { text: `${label} · paused`, style: 'border-hairline bg-canvas text-ink' };
    return { text: label, style: STATUS_STYLE[status] };
  };
  return (
    <section aria-label="Source feeds" className={embedded ? '' : 'ls-card px-4 py-3'} data-testid="source-status" data-run-state={run}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{heading}</h2>
      </div>
      <ul className="mt-2 grid gap-2 md:grid-cols-3">
        {feeds.map((f) => (
          <li key={f.hospitalId} className="rounded-lg border border-hairline px-3 py-2" data-testid={`source-${f.hospitalId}`}>
            <p className="truncate text-sm font-semibold text-ink" title={f.facilityName}>
              {f.facilityName}
            </p>
            <p className="text-[11px] text-muted">{SOURCE_TYPE[f.hospitalId]}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chip(f.status).style}`}>
                {chip(f.status).text}
              </span>
              <span className="text-muted">Last observation: {minutesText(simulator.minutesSinceResult(f.hospitalId))}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {f.eventsReceived.toLocaleString('en-US')} messages · {f.terminologyMappedPercent.toFixed(1)}% mapped ·{' '}
              {f.completenessPercent.toFixed(1)}% complete · {feedNote(f.note)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const KIND_LABEL: Record<AuditEntry['kind'], string> = {
  observation: 'Observation',
  unmapped: 'Unmapped code',
  rejected: 'Rejected',
  score: 'Score (today so far)',
  close: 'Day closed',
  day: 'Day',
  source: 'Source',
};

/**
 * What the feeds did and what it changed. Never shows a patient reference,
 * a pseudonym or a result value: score changes are explained by the engine's
 * own component points.
 */
export function ActivityStream({ limit = 40, kinds, embedded = false }: { limit?: number; kinds?: AuditEntry['kind'][]; embedded?: boolean }) {
  const { simulator } = useLiveSurveillance();
  const entries = simulator.audit.filter((e) => !kinds || kinds.includes(e.kind)).slice(-limit).reverse();
  // Only day closes and source changes are announced: each observation would be noise.
  const announce = [...simulator.audit].reverse().find((e) => e.kind === 'source' || (e.kind === 'close' && e.profileId === 'respiratory-viral-syndrome'));
  return (
    <section aria-labelledby="activity-heading" className={`flex min-h-0 flex-col ${embedded ? 'rounded-lg border border-hairline' : 'ls-card'}`} data-testid="activity-stream">
      <header className="ls-card-header">
        <h2 id="activity-heading" className="ls-card-title">Live activity</h2>
        <span className="text-[11px] text-muted">Newest first</span>
      </header>
      <p className="sr-only" aria-live="polite">
        {announce ? announce.text.replace(' from the simulated ', ' from the ') : ''}
      </p>
      {entries.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No activity yet. Start the live simulation to see observations arrive.</p>
      ) : (
        <ol className="max-h-[28rem] divide-y divide-hairline overflow-y-auto" tabIndex={0} aria-label="Live activity, newest first">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-2 text-xs">
              <p className="flex flex-wrap items-center gap-x-2 text-muted">
                <span className="font-mono tabular-nums">{liveDayLabel(e.dayIndex)} {clock(e.minute)}</span>
                <span className="font-semibold uppercase tracking-[0.05em]">{KIND_LABEL[e.kind]}</span>
              </p>
              {/* The page and top bar already say the sources are simulated. */}
              <p className="mt-0.5 text-ink">{e.text.replace(' from the simulated ', ' from the ')}</p>
              {e.drivers && e.drivers.length ? (
                <p className="mt-0.5 text-muted">
                  Drivers: {e.drivers.map((d) => `${d.label} ${d.before} → ${d.after} points`).join('; ')}
                  {e.facilityChanges && e.facilityChanges.length ? `; ${e.facilityChanges.join('; ')}` : ''}
                </p>
              ) : e.facilityChanges && e.facilityChanges.length ? (
                <p className="mt-0.5 text-muted">{e.facilityChanges.join('; ')}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/** The open day's calculation so far, per live profile — provisional until the day closes. */
export function TodaySoFar({ embedded = false }: { embedded?: boolean }) {
  const { simulator } = useLiveSurveillance();
  const provisional = liveProvisional(simulator);
  const { dayIndex } = dayAndMinuteOf(simulator.op);
  return (
    <section aria-label="Today so far" className={embedded ? '' : 'ls-card px-4 py-3'} data-testid="today-so-far">
      <h2 className="text-sm font-semibold text-ink">
        {simulator.finished ? 'Live period complete' : `Today so far · ${liveDayLabel(dayIndex)} (provisional)`}
      </h2>
      <p className="text-[11px] text-muted">
        Provisional: recalculated with every observation. Today&apos;s volume is still being compared with a
        full-day baseline, so these scores build up as results arrive. For comparisons use closed days: at 19:30
        the day closes and becomes the current signal.
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {LIVE_PROFILES.map((id) => {
          const p = provisional[id];
          return (
            <li key={id} className="rounded-lg border border-hairline px-3 py-2">
              <p className="text-xs font-semibold text-ink">{PROFILE_BY_ID[id].displayName}</p>
              {p?.score ? (
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums text-ink">{p.score.composite}</span>
                  <SeverityBadge severity={p.score.severity} />
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">{p?.status === 'NO_DATA' || !p ? 'No results yet today' : 'No score'}</p>
              )}
              <p className="text-[11px] text-muted">{p ? `${p.scenario.totalTests} ${p.scenario.totalTests === 1 ? 'result' : 'results'} so far` : ''}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Enter one synthetic test observation into Live Surveillance. The person
 * changes data, never an outcome: the observation goes through its facility's
 * own adapter, routing and recalculation like any other. A test tool, so it
 * lives under System (Integration Demo), not on the Dashboard.
 */
export function InjectObservation() {
  const { inject, simulator } = useLiveSurveillance();
  const [hospitalId, setHospitalId] = useState<HospitalId>('HOSP-A');
  const [code, setCode] = useState<LiveTestCode>('94500-6');
  const [positive, setPositive] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  return (
    <section aria-labelledby="test-tools-title" className="ls-card" data-testid="inject">
      <header className="ls-card-header">
        <div className="min-w-0">
          <h2 id="test-tools-title" className="ls-card-title">
            Test tools: inject a synthetic test observation
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Sends one observation into Live Surveillance; its effect shows on the Dashboard.
          </p>
        </div>
        <Link to="/dashboard" className="shrink-0 text-xs font-semibold text-brand hover:underline">
          Open the Dashboard <span aria-hidden="true">→</span>
        </Link>
      </header>
      <div className="px-5 pb-5 pt-3">
        <p className="mt-1 text-xs text-muted">
          A test observation, not a patient result. It is sent in the facility&apos;s source format and processed
          exactly like any other observation; scores change only through the data.
        </p>
        <form
          className="mt-2 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (simulator.finished) return setDone('The live period is complete. Reset to inject observations.');
            inject(hospitalId, code, positive);
            return setDone(`Sent: ${TEST_NAMES[code]}, ${positive ? 'positive' : 'negative'}, from ${shortFacilityName(hospitalId)} (${SOURCE_TYPE[hospitalId]}).`);
          }}
        >
          <label className="text-xs font-semibold text-ink">
            Facility
            <select className="ls-select mt-1 block" value={hospitalId} onChange={(e) => setHospitalId(e.target.value as HospitalId)}>
              {HOSPITALS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({SOURCE_TYPE[h.id]})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink">
            Test
            <select className="ls-select mt-1 block" value={code} onChange={(e) => setCode(e.target.value as LiveTestCode)}>
              {(Object.keys(TEST_NAMES) as LiveTestCode[]).map((c) => (
                <option key={c} value={c}>
                  {TEST_NAMES[c]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-xs font-semibold text-ink">
            <legend>Result</legend>
            <div className="mt-1 flex gap-3">
              {[true, false].map((value) => (
                <label key={String(value)} className="flex items-center gap-1 font-normal">
                  <input type="radio" name="inject-result" checked={positive === value} onChange={() => setPositive(value)} />
                  {value ? 'Positive' : 'Negative'}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="ls-btn px-3 py-1.5 text-sm">
            Send test observation
          </button>
        </form>
        {done ? (
          <p role="status" className="mt-2 text-xs text-ink">
            {done}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * How an observation becomes a signal in Live Surveillance, and why no
 * statistical confirmation is shown. Explanatory, so it lives under System
 * (Architecture), not on the Dashboard; the methods are on Detection Methods.
 */
export function LiveHowItWorks() {
  const reference = settingsFor(RVS_PROFILE_ID).ewma.referenceDays;
  return (
    <div data-testid="live-how-it-works">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink" aria-label="From observation to signal">
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
      <p className="mt-2 text-xs">
        <Link to="/dynamic-surveillance" className="font-semibold text-brand hover:underline">
          View Detection Methods <span aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const ICON = 'h-4 w-4';
const SourcesIcon = () => (
  <svg viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2.5 8a5.5 5.5 0 0 1 11 0M5 8a3 3 0 0 1 6 0" />
    <circle cx="8" cy="8" r="1" fill="currentColor" />
    <path d="M8 9v4.5" />
  </svg>
);
const TodayIcon = () => (
  <svg viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
  </svg>
);
const ActivityIcon = () => (
  <svg viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 8.5h3l2-5 3 9 2-4h3" />
  </svg>
);

/** "3 / 3 sources ready", "2 / 3 active · Shrewsbury delayed": from the same feed state as the panel. */
function SourcesSummary() {
  const { feeds, active, run } = useLiveRun();
  if (run === 'idle') return <>{`${feeds.filter((f) => f.isReporting).length} / ${feeds.length} sources ready`}</>;
  if (run === 'complete') return <>Live period complete</>;
  const issues = feeds
    .filter((f) => f.status !== 'HEALTHY')
    .map((f) => `${shortFacilityName(f.hospitalId)} ${FEED_ISSUE[f.status] ?? f.status.toLowerCase()}`);
  return <>{[`${run === 'paused' ? 'Paused · ' : ''}${active} / ${feeds.length} active`, ...issues].join(' · ')}</>;
}

/** The open day and its results so far (Respiratory Viral Activity: every live test). */
function TodaySummary() {
  const { simulator } = useLiveSurveillance();
  if (simulator.finished) return <>Live period complete</>;
  const total = liveProvisional(simulator)[RVS_PROFILE_ID]?.scenario.totalTests ?? 0;
  const { dayIndex } = dayAndMinuteOf(simulator.op);
  const results = total === 0 ? 'No results yet' : `${total.toLocaleString('en-US')} ${total === 1 ? 'result' : 'results'} so far`;
  return <>{`${liveDayLabel(dayIndex)} · ${results}`}</>;
}

/** The newest entry of the activity stream, or that there is none yet. */
function ActivitySummary() {
  const { simulator } = useLiveSurveillance();
  const latest = simulator.audit[simulator.audit.length - 1];
  if (!latest) return <>No activity yet</>;
  return <>{`Latest: ${KIND_LABEL[latest.kind]} · ${latest.text.replace(' from the simulated ', ' from the ')}`}</>;
}

/**
 * Live Surveillance on the Dashboard, beneath the header's controls: the run
 * state in one line, then the operational detail as three collapsed cards —
 * Source activity, Today so far and the Activity stream — each with a one-line
 * summary. The test tools and how it works are under System.
 */
export function LiveOperations() {
  return (
    <section aria-label="Live Surveillance" className="ls-card" data-testid="dashboard-live">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <LiveStatusLine bare />
        <LiveProgress />
      </div>
      <div className="space-y-2 border-t border-hairline p-3">
        <ExpandableCard icon={<SourcesIcon />} title="Source activity" summary={<SourcesSummary />} testId="live-sources">
          <SourceStatusPanel embedded />
        </ExpandableCard>
        <ExpandableCard icon={<TodayIcon />} title="Today so far" summary={<TodaySummary />} testId="live-today">
          <TodaySoFar embedded />
        </ExpandableCard>
        <ExpandableCard icon={<ActivityIcon />} title="Activity stream" summary={<ActivitySummary />} testId="live-activity">
          <ActivityStream embedded />
        </ExpandableCard>
      </div>
    </section>
  );
}
