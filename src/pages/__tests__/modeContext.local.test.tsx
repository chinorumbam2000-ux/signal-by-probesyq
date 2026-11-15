// @vitest-environment jsdom
/**
 * Live Surveillance never speaks Scenario Replay's language (replay days,
 * replay data, the narrated five-day scenario), and Scenario Replay keeps it.
 * The Dashboard summarises the live feed in one line; the sources are
 * detailed only on the Live Surveillance page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { MINUTES_PER_TICK, MODE_STORAGE_KEY, TICK_MS } from '../../context/LiveSurveillanceContext';
import { ALL_DATES } from '../../lib/live/dataset';
import { END_MINUTE, operatingMinute } from '../../lib/live/simulator';
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

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
const WAIT = { timeout: 5000 };
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0];
const main = () => document.querySelector('main') as HTMLElement;
/** Visible text plus every accessible label and caption on the page. */
const pageWords = () =>
  [
    main().textContent ?? '',
    ...[...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? ''),
  ].join('\n');
/** Scenario Replay's language — never correct in Live Surveillance. */
const REPLAY_WORDING = /replay day|Scenario Replay data|Derived from the replay|narrated five-day|as the replay advances|selected replay day|current replay day|\bDay \d+\b|Day 1 → current/i;
const dayIndex = (iso: string) => ALL_DATES.indexOf(iso) + 1;

/** Live at 4×, paused at Feb 13 10:30 — during the Shrewsbury Community outage. */
async function liveDuringOutage() {
  renderAt('/live');
  await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
  vi.useFakeTimers();
  fireEvent.click(button('4×'));
  fireEvent.click(button('Start Live Surveillance'));
  const target = operatingMinute(dayIndex('2026-02-13'), 10 * 60 + 30);
  act(() => {
    vi.advanceTimersByTime(Math.ceil(target / (MINUTES_PER_TICK * 4)) * TICK_MS);
  });
  fireEvent.click(button('❚❚ Pause'));
  vi.useRealTimers();
}
const go = async (link: RegExp, heading: RegExp) => {
  fireEvent.click(screen.getAllByRole('link', { name: link })[0]);
  await screen.findByRole('heading', { level: 1, name: heading }, WAIT);
};

describe('Live Surveillance: no Scenario Replay wording', () => {
  it('Dashboard, Signals, Facilities, Analytics and Map speak in live dates', { timeout: 30000 }, async () => {
    await liveDuringOutage();
    const pages: Array<[RegExp, RegExp]> = [
      [/^Dashboard/, /Regional Outbreak Status/],
      [/^Signals/, /Signals/],
      [/^Facilities/, /Facilities/],
      [/^Analytics/, /Trends/],
      [/^Outbreak Map/, /Outbreak Map/],
    ];
    for (const [link, heading] of pages) {
      await go(link, heading);
      const words = pageWords();
      expect(words.match(REPLAY_WORDING)?.[0] ?? null, String(heading)).toBeNull();
    }
  });

  it('Dashboard: live data origin, live profile settings, live dates in the indicators’ change', { timeout: 20000 }, async () => {
    await liveDuringOutage();
    await go(/^Dashboard/, /Regional Outbreak Status/);
    expect(within(screen.getByTestId('profile-card-influenza-a')).getByText('Live Surveillance data')).toBeTruthy();
    const heading = screen.getByTestId('profile-heading');
    expect(heading.textContent).toContain('Live Surveillance data');
    expect(heading.textContent).toContain('Live Surveillance: rolling 7-day baseline');
    for (const change of screen.getAllByTestId('kpi-change')) expect(change.textContent).toMatch(/ vs Feb 11$| since Feb 11 withheld/);
    expect(screen.getByTestId('score-movement').textContent).toMatch(/^Why the score moved · [+−±]\d+ since Feb 11/);
  });

  it('Signals: live wording, and acknowledge buttons name the live date', { timeout: 20000 }, async () => {
    await liveDuringOutage();
    await go(/^Signals/, /Signals/);
    expect(main().textContent).toContain('do not change as later live days close');
    // The queue only: current figures are on the Dashboard, linked once.
    expect(main().textContent).not.toMatch(/Current regional figures|Current composite score|Current scope/);
    expect(screen.getByTestId('current-figures-link').textContent).toContain('View profile on Dashboard');
    const acks = screen.getAllByRole('button', { name: /^Acknowledge alert:/ });
    expect(acks.length).toBeGreaterThan(0);
    for (const ack of acks) expect(ack.getAttribute('aria-label')).toMatch(/, detected on Feb \d+$/);
  });

  it('Facilities and Analytics: live dates on the charts, live closed-day rule', { timeout: 20000 }, async () => {
    await liveDuringOutage();
    await go(/^Facilities/, /Facilities/);
    expect(screen.getAllByText('Through Feb 12')).toHaveLength(2);
    await go(/^Analytics/, /Trends/);
    expect(main().textContent).toContain('Closed days only: the open day is provisional and joins the trend when it closes at 19:30.');
  });

  it('Investigations and Reports show the Live note, never the replay’s Day 1 state', { timeout: 20000 }, async () => {
    await liveDuringOutage();
    for (const [link, heading] of [[/^Investigations/, /Investigations/], [/^Reports/, /Public Health Reports/]] as const) {
      await go(link, heading);
      const note = screen.getByTestId('live-mode-note');
      expect(within(note).getByRole('link', { name: 'Signals page' }).getAttribute('href')).toBe('/signals');
      expect(main().textContent).not.toMatch(/Nothing to investigate yet|No reports prepared yet|through Day \d/);
      expect(pageWords().match(REPLAY_WORDING)?.[0] ?? null).toBeNull();
    }
  });
});

describe('Scenario Replay keeps its own wording', () => {
  it('replay days, replay data and the replay rules', { timeout: 30000 }, async () => {
    chooseScenarioReplayForTest();
    renderAt('/replay');
    await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT);
    for (let i = 0; i < 4; i += 1) fireEvent.click(button('Next replay day'));
    await go(/^Dashboard/, /Regional Outbreak Status/);
    expect((await screen.findByTestId('profile-heading', undefined, WAIT)).textContent).toContain('Scenario Replay data');
    expect(screen.getAllByTestId('kpi-change').map((c) => c.textContent)).toHaveLength(5);
    for (const change of screen.getAllByTestId('kpi-change')) expect(change.textContent).toMatch(/ vs Day 4$/);
    expect(screen.getByTestId('score-movement').textContent).toMatch(/^Why the score moved · \+13 since Day 4/);
    await go(/^Signals/, /Signals/);
    expect(main().textContent).toContain('do not change as the replay advances');
    expect(main().textContent).not.toMatch(/Current regional figures|Current composite score|Current scope/);
    expect(screen.getAllByRole('button', { name: /^Acknowledge alert:/ })[0].getAttribute('aria-label')).toMatch(/, detected on replay day \d$/);
    await go(/^Facilities/, /Facilities/);
    expect(screen.getAllByText('Day 1 → current')).toHaveLength(2);
    await go(/^Analytics/, /Trends/);
    expect(main().textContent).toContain('Values beyond the current replay day are withheld');
    await go(/^Investigations/, /Investigations/);
    expect(screen.queryByTestId('live-mode-note')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Under review' })).toBeTruthy();
  });
});

describe('Dashboard / Live Surveillance overlap', () => {
  it('the Dashboard has one read-only Live status line and no source cards', async () => {
    renderAt('/dashboard');
    const live = await screen.findByTestId('dashboard-live', undefined, WAIT);
    const line = within(live).getByTestId('dashboard-live-status');
    expect(line.textContent?.replace(/·, /g, ' · ')).toBe('Live Surveillance · Not started · 3 / 3 sources ready');
    expect(line.getAttribute('role')).toBe('status');
    expect(within(live).queryAllByRole('button')).toEqual([]);
    expect(within(live).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByTestId('source-status')).toBeNull();
    expect(screen.queryByTestId('source-HOSP-A')).toBeNull();
    expect(main().textContent).not.toMatch(/FHIR R4|HL7 v2|LIS\/API|Last observation/);
    // The Start here strip keeps the one Dashboard link to the page.
    const strip = screen.getByTestId('start-here');
    expect(within(strip).getByRole('link', { name: 'Open Live Surveillance' }).getAttribute('href')).toBe('/live');
    expect(within(strip).getByRole('link', { name: 'View Scenario Replay' }).getAttribute('href')).toBe('/replay');
    expect(within(main()).getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/live'))).toHaveLength(1);
  });

  it('the line follows the actual state: the outage, pause, completion', { timeout: 30000 }, async () => {
    await liveDuringOutage();
    await go(/^Dashboard/, /Regional Outbreak Status/);
    const line = () => screen.getByTestId('dashboard-live-status');
    const text = () => line().textContent?.replace(/·, /g, ' · ');
    expect(text()).toBe('Live Surveillance · Paused · 2 / 3 sources active · Shrewsbury Community delayed');
    expect(line().getAttribute('data-run-state')).toBe('paused');
    // No Start here once the feed has started, and still no link in the line.
    expect(screen.queryByTestId('start-here')).toBeNull();
    expect(within(screen.getByTestId('dashboard-live')).queryAllByRole('link')).toEqual([]);
    // Run to the end on the Live page, then back.
    await go(/^Live Surveillance/, /^Live Surveillance$/);
    vi.useFakeTimers();
    fireEvent.click(button('▶ Resume'));
    act(() => {
      vi.advanceTimersByTime(Math.ceil(END_MINUTE / (MINUTES_PER_TICK * 4)) * TICK_MS);
    });
    vi.useRealTimers();
    await go(/^Dashboard/, /Regional Outbreak Status/);
    expect(text()).toBe('Live Surveillance · Complete');
  });

  it('a running feed with all sources healthy', { timeout: 20000 }, async () => {
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    fireEvent.click(button('Start Live Surveillance'));
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 8);
    });
    fireEvent.click(screen.getAllByRole('link', { name: /^Dashboard/ })[0]);
    expect(screen.getByTestId('dashboard-live-status').textContent?.replace(/·, /g, ' · ')).toBe('Live Surveillance · Running · 3 / 3 sources active');
    fireEvent.click(screen.getAllByRole('link', { name: /^Live Surveillance/ })[0]);
    fireEvent.click(button('❚❚ Pause'));
    vi.useRealTimers();
  });

  it('the Live page keeps the detailed source cards, with one disclosure', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/live');
    const panel = await screen.findByTestId('source-status', undefined, WAIT);
    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('Sources · not started');
    for (const [id, type] of [['HOSP-A', 'FHIR R4'], ['HOSP-B', 'HL7 v2'], ['HOSP-C', 'LIS/API']]) {
      const card = within(panel).getByTestId(`source-${id}`);
      expect(within(card).getByText(type)).toBeTruthy();
      expect(card.textContent).toMatch(/Last observation:/);
      expect(card.textContent).toMatch(/messages · [\d.]+% mapped · [\d.]+% complete/);
      // The heading discloses it once; the cards do not repeat "simulated".
      expect(card.textContent).not.toMatch(/simulated/i);
    }
    expect(panel.textContent).not.toMatch(/times are simulated/);
    expect(screen.getByTestId('activity-stream').textContent).not.toMatch(/simulated time/);
    // The top bar: one disclosure, then the date without a "simulated clock" suffix.
    const bar = screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
    expect(bar.textContent).toContain('Live Surveillance · Simulated source feeds');
    expect(bar.textContent).not.toMatch(/simulated clock/);
  });
});
