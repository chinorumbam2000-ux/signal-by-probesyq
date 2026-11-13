// @vitest-environment jsdom
/**
 * The Dashboard is a concise overview, not a copy of other pages: one home for
 * the score, key indicators carrying their own day-over-day change, the
 * engine's "Why the score moved", and one alert summary that links to Signals.
 * Signals keeps the alert queue and its actions; Facilities the five Data
 * Confidence inputs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
import { getDayOverDayComparison } from '../../lib/dayOverDay';
import { getProfileAlerts } from '../../lib/profiles/portfolio';
import { PROFILE_BY_ID } from '../../lib/profiles/registry';
import { alertsAwaitingReview } from '../../components/dashboard/AlertSummary';
import { MINUTES_PER_TICK, TICK_MS } from '../../context/LiveSurveillanceContext';
import { ALL_DATES } from '../../lib/live/dataset';
import { operatingMinute } from '../../lib/live/simulator';
import type { AcknowledgementRecord } from '../../types';
import { chooseScenarioReplayForTest, signInForTest } from './signedIn';

vi.mock('../../components/map/OutbreakMap', () => ({
  default: () => <div data-testid="outbreak-map" />,
}));

beforeEach(() => {
  vi.stubGlobal('fetch', async () => {
    throw new Error('Local mode must not make requests');
  });
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.sessionStorage.clear();
  window.localStorage.clear();
  signInForTest();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const WAIT = { timeout: 5000 };
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
const main = () => document.querySelector('main') as HTMLElement;
const atDay = (day: 1 | 2 | 3 | 4 | 5, acknowledgements: Record<string, AcknowledgementRecord> = {}) =>
  saveSession({ day, acknowledgements, investigations: {}, reports: [] });
async function replayDashboard(day: 1 | 2 | 3 | 4 | 5, path = '/dashboard', acks?: Record<string, AcknowledgementRecord>) {
  chooseScenarioReplayForTest();
  atDay(day, acks);
  renderAt(path);
  await screen.findByTestId('active-surveillance', {}, WAIT);
}

describe('Dashboard hierarchy (Scenario Replay, Day 5)', () => {
  it('keeps Active Surveillance’s headline, cards and Other profiles, without the status tiles', async () => {
    await replayDashboard(5);
    const section = screen.getByTestId('active-surveillance');
    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe('4 signals require attention');
    expect(within(section).queryByLabelText('Profile status counts')).toBeNull();
    expect(within(section).getAllByRole('listitem').length).toBeGreaterThan(4);
    expect(within(section).getByRole('list', { name: 'Other profiles' })).toBeTruthy();
    // The period is named once, in the page header.
    expect(section.textContent).not.toMatch(/Replay Day \d/);
    expect(screen.getByText('Replay Day 5 of 5 · Regional Early-Warning Signal')).toBeTruthy();
  });

  it('the profile heading names the profile and its severity, without the score sentence or breakdown', async () => {
    await replayDashboard(5, '/dashboard?profile=influenza-a');
    const heading = screen.getByTestId('profile-heading');
    expect(within(heading).getByRole('heading', { level: 2 }).textContent).toBe('Influenza A');
    expect(heading.textContent).toContain('Pathogen profile');
    expect(heading.textContent).toContain('Active signal');
    expect(heading.textContent).toMatch(/Critical|High|Moderate|Watch/);
    expect(heading.textContent).not.toMatch(/scores \d+/);
    expect(within(heading).queryByTestId('score-components')).toBeNull();
    expect(screen.getByTestId('profile-scope')).toBeTruthy();
  });

  it('one score section: the outbreak score and Data Confidence, with a link to facility data quality', async () => {
    await replayDashboard(5);
    const section = screen.getByRole('region', { name: 'Outbreak score and data confidence' });
    expect(within(section).getByTestId('outbreak-score').textContent).toContain('87 / 100');
    expect(within(section).getByTestId('outbreak-score').textContent).toContain('How concerning the epidemiological signal is.');
    const confidence = within(section).getByTestId('data-confidence');
    expect(confidence.textContent).toContain('never changes the outbreak score');
    const link = within(confidence).getByRole('link', { name: 'View facility data quality' });
    expect(link.getAttribute('href')).toBe('/facilities?profile=respiratory-viral-syndrome');
    // The five-tile Data Quality section is gone.
    expect(screen.queryByRole('heading', { name: /Data quality/ })).toBeNull();
    for (const tile of ['Facilities Reporting', 'Facility Feed Health', 'LOINC Mapping Quality', 'Data Completeness', 'Last Event Received']) {
      expect(main().textContent).not.toContain(tile);
    }
    expect(screen.queryByRole('button', { name: 'View Data Confidence' })).toBeNull();
    // No "Replay Day 5 of 5 · … · replay date" footer under the scores.
    expect(section.textContent).not.toMatch(/replay date|Replay Day/);
  });

  it('each key indicator carries the engine’s own change since the previous day', async () => {
    await replayDashboard(5);
    const comparison = getDayOverDayComparison(5);
    const metric = (label: string) => comparison.metrics.find((m) => m.label === label)!;
    const tiles = screen.getAllByTestId('kpi-card');
    expect(tiles.map((t) => t.querySelector('.ls-label')?.textContent)).toEqual([
      'Tests', 'Positivity', 'Affected Facilities', 'Affected Areas', 'Persistence',
    ]);
    const labels = ['Tests', 'Positivity', 'Affected facilities', 'Affected geographic areas', 'Persistence'];
    tiles.forEach((tile, i) => {
      const m = metric(labels[i]);
      const change = within(tile).getByTestId('kpi-change');
      expect(change.textContent).toContain(`${m.delta} vs Day 4`);
      // Direction in words for screen readers, never colour or arrow alone.
      const spoken = { up: 'Up: ', down: 'Down: ', none: 'Unchanged: ' }[m.direction];
      expect(change.querySelector('.sr-only')?.textContent).toBe(spoken);
    });
    expect(tiles[0].textContent).toContain('176');
    expect(tiles[0].textContent).toContain('+76% vs baseline 100');
  });

  it('removes the comparison table; "Why the score moved" keeps the engine’s explanation', async () => {
    await replayDashboard(5);
    expect(screen.queryByRole('region', { name: 'Day-to-day change' })).toBeNull();
    expect(main().querySelector('table')).toBeNull();
    const why = screen.getByTestId('score-movement');
    expect(within(why).getByRole('heading', { level: 3 }).textContent).toBe('Why the score moved · +13 since Day 4');
    expect(why.textContent).toContain(getDayOverDayComparison(5).explanation);
  });

  it('one alert summary: the highest-priority alert awaiting review and a link to Signals, no actions', async () => {
    await replayDashboard(5);
    const awaiting = alertsAwaitingReview(getProfileAlerts(5));
    const top = awaiting[0];
    const summary = screen.getByTestId('alert-summary');
    const line = within(summary).getByTestId('top-alert');
    expect(line.textContent).toContain(`${PROFILE_BY_ID[top.profileId].displayName} — ${top.title}`);
    // Severity in words once, on the badge.
    expect(line.textContent).toContain(`${top.detection.severity}${PROFILE_BY_ID[top.profileId].displayName} — ${top.title} · score ${top.detection.compositeScore} at detection · detected Day ${top.detectedDay}`);
    expect(within(summary).getByTestId('alerts-awaiting').textContent).toBe(`${awaiting.length} alerts awaiting review`);
    const link = within(summary).getByRole('link', { name: 'Review in Signals' });
    expect(link.getAttribute('href')).toBe('/signals?profile=all');
    // No list of every alert, and no alert actions on the Dashboard.
    expect(within(summary).queryAllByRole('listitem')).toEqual([]);
    expect(within(summary).queryAllByRole('button')).toEqual([]);
    for (const name of [/Acknowledge/, /Investigat/, /Dismiss (the )?(alert|signal)/, /Why This Signal/]) {
      expect(within(main()).queryAllByRole('button', { name })).toEqual([]);
    }
    expect(screen.queryByRole('list', { name: /alerts$/ })).toBeNull();
  });

  it('says "No alerts require review" once every alert is acknowledged', async () => {
    const acks = Object.fromEntries(
      getProfileAlerts(5).map((a) => [a.id, { day: 5, simulationTime: '2026-02-12T12:00:00', realTime: '2026-02-12T12:00:00Z' }]),
    ) as Record<string, AcknowledgementRecord>;
    await replayDashboard(5, '/dashboard', acks);
    const summary = screen.getByTestId('alert-summary');
    expect(within(summary).getByTestId('top-alert').textContent).toBe('No alerts require review');
    expect(within(summary).getByTestId('alerts-awaiting').textContent).toBe('Every alert has been acknowledged.');
    expect(within(summary).getByRole('link', { name: 'Open Signals' }).getAttribute('href')).toBe('/signals?profile=all');
  });

  it('shows the score once in the score section, never as "Composite Score" text or a score sentence', async () => {
    await replayDashboard(5);
    const text = main().textContent ?? '';
    expect(text).not.toMatch(/Composite Score\b/);
    expect(text).not.toMatch(/scores 87|composite score is/i);
    const scoreLabels = [...main().querySelectorAll('.ls-label')].filter((e) => /Outbreak Signal Score/.test(e.textContent ?? ''));
    expect(scoreLabels).toHaveLength(1);
    const standalone87 = [...main().querySelectorAll('p')].filter((p) => /^87(\s*\/ 100| out of 100)?$/.test(p.textContent ?? ''));
    // Section 1, and the profile's Active Surveillance card.
    expect(standalone87).toHaveLength(2);
  });

  it('headings run h1 → h2 → h3 without skipping, with no numbered sections', async () => {
    await replayDashboard(5);
    const levels = [...main().querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    expect(main().textContent).not.toMatch(/Section \d/);
    const h2s = [...main().querySelectorAll('h2')].map((h) => h.textContent);
    for (const title of ['Outbreak score and data confidence', 'Key indicators', 'Geographic summary', 'Highest-priority alert']) {
      expect(h2s).toContain(title);
    }
  });

  it('keeps the map summary, the trend chart and the profile selector', async () => {
    await replayDashboard(5);
    expect(screen.getByTestId('outbreak-map')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Highest-risk surveillance area' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Outbreak Map' }).getAttribute('href')).toBe('/map?profile=respiratory-viral-syndrome');
    expect(screen.getByText('Test Volume & Positivity Trend')).toBeTruthy();
    expect((screen.getByLabelText('Surveillance profile') as HTMLSelectElement).value).toBe('respiratory-viral-syndrome');
  });

  it('Day 1: no change to show yet, and no alerts', async () => {
    await replayDashboard(1);
    expect(screen.queryAllByTestId('kpi-change')).toEqual([]);
    expect(screen.getByTestId('score-movement').textContent).toContain('Baseline — no previous surveillance day available.');
    expect(screen.getByTestId('top-alert').textContent).toBe('No alerts require review');
    expect(screen.getByTestId('alerts-awaiting').textContent).toBe('No alerts raised.');
  });
});

describe('Dashboard hierarchy (Live Surveillance)', () => {
  it('live dates on the indicators’ change and the alert summary; no replay wording', { timeout: 20000 }, async () => {
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    fireEvent.click(screen.getAllByRole('button', { name: '4×' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Live Surveillance' })[0]);
    const target = operatingMinute(ALL_DATES.indexOf('2026-02-13') + 1, 10 * 60 + 30);
    act(() => {
      vi.advanceTimersByTime(Math.ceil(target / (MINUTES_PER_TICK * 4)) * TICK_MS);
    });
    fireEvent.click(screen.getAllByRole('button', { name: '❚❚ Pause' })[0]);
    vi.useRealTimers();
    fireEvent.click(screen.getAllByRole('link', { name: /^Dashboard/ })[0]);
    await screen.findByTestId('active-surveillance', {}, WAIT);

    expect(screen.getByTestId('dashboard-live-status')).toBeTruthy();
    for (const change of screen.getAllByTestId('kpi-change')) expect(change.textContent).toMatch(/ vs Feb 11$| since Feb 11 withheld/);
    expect(screen.getByTestId('top-alert').textContent).toMatch(/detected Feb \d+$/);
    expect(screen.getByTestId('alerts-awaiting').textContent).toMatch(/^\d+ alerts? awaiting review$/);
    expect(screen.getByTestId('active-surveillance').textContent).not.toContain('latest closed day');
    expect(main().textContent).not.toMatch(/replay day|\bDay \d+\b|Section \d/i);
    expect(screen.getByTestId('profile-heading').textContent).not.toMatch(/scores \d+/);
  });
});
