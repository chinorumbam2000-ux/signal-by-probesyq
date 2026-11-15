// @vitest-environment jsdom
/**
 * Each thing in one place. The top bar carries the global context (mode and
 * its one simulated-data disclosure, the clock or replay day, the selected
 * profile's reading, the alerts bell, the analyst); the sidebar the mode
 * switch and navigation, not a second copy of the date; the bell lists alerts
 * and links to Signals, where they are acknowledged; the profile selector
 * names profiles; Signals is the alert queue, not a copy of the Dashboard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
import { getProfileAlerts } from '../../lib/profiles/portfolio';
import { PROFILES } from '../../lib/profiles/registry';
import { MINUTES_PER_TICK, TICK_MS } from '../../context/LiveSurveillanceContext';
import { ALL_DATES } from '../../lib/live/dataset';
import { operatingMinute } from '../../lib/live/simulator';
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
const topBar = () => screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
const sidebar = () => screen.getAllByRole('navigation', { name: 'Primary' })[0];
async function replayAt(path: string, day: 1 | 2 | 3 | 4 | 5 = 5) {
  chooseScenarioReplayForTest();
  saveSession({ day, acknowledgements: {}, investigations: {}, reports: [] });
  renderAt(path);
  await screen.findByRole('heading', { level: 1 }, WAIT);
}
/** Live at 4×, paused at Feb 13 10:30. */
async function liveAt(link: RegExp, heading: RegExp) {
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
  fireEvent.click(screen.getAllByRole('link', { name: link })[0]);
  await screen.findByRole('heading', { level: 1, name: heading }, WAIT);
}

describe('sidebar', () => {
  it('has no date or status card in Scenario Replay; keeps the mode switch, navigation, System and About', async () => {
    await replayAt('/signals');
    const nav = sidebar();
    expect(nav.textContent).not.toMatch(/Replay Day|Replay date|5 of 5|Nov \d/);
    expect(within(nav).getByRole('group', { name: 'Surveillance mode' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Scenario Replay' }).getAttribute('aria-pressed')).toBe('true');
    for (const name of [/^Dashboard/, /^Signals/, /^Facilities/, /^Analytics/]) {
      expect(within(nav).getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
    expect(within(nav).getByLabelText(/alerts awaiting acknowledgement across all profiles$/)).toBeTruthy();
    expect(within(nav).getByRole('group', { name: 'System' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'About this data' })).toBeTruthy();
  });

  it('has no live date or run status in Live Surveillance', { timeout: 20000 }, async () => {
    await liveAt(/^Signals/, /Signals/);
    const nav = sidebar();
    expect(nav.textContent).not.toMatch(/Live surveillance date|Feb 13|Feeds running|Not started|Paused/i);
    expect(within(nav).getByRole('button', { name: 'Live Surveillance' }).getAttribute('aria-pressed')).toBe('true');
    // The top bar keeps them, at every width.
    expect(within(topBar()).getByTestId('live-clock').textContent).toContain('Feb 13 · 10:30');
    expect(within(topBar()).getByTestId('live-run-status').textContent).toContain('Paused');
  });
});

describe('top bar', () => {
  it('Scenario Replay: the mode and its disclosure in one line, then the day and its controls', async () => {
    await replayAt('/signals');
    const bar = topBar();
    const disclosure = within(bar).getByTestId('mode-disclosure');
    expect(disclosure.textContent).toBe('Scenario Replay · Simulated surveillance data — about replay data');
    expect(bar.textContent?.match(/Scenario Replay/g)).toHaveLength(1);
    expect(bar.textContent?.match(/Simulated/gi)).toHaveLength(1);
    expect(bar.textContent).not.toMatch(/Current mode|Replay Day/);
    expect(within(bar).getByTestId('replay-day').textContent).toMatch(/^Day 5 of 5/);
    expect(within(bar).getByRole('button', { name: 'Next replay day' })).toBeTruthy();
  });

  it('Live: one simulated-feeds disclosure, and the page header does not add "simulated time"', { timeout: 20000 }, async () => {
    await liveAt(/^Dashboard/, /Regional Outbreak Status/);
    const bar = topBar();
    expect(within(bar).getByTestId('mode-disclosure').textContent).toBe(
      'Live Surveillance · Simulated source feeds — about the live simulation',
    );
    expect(bar.textContent?.match(/simulated/gi)).toHaveLength(1);
    expect(main().querySelector('header')?.textContent).not.toMatch(/simulated (time|clock)/i);
    // The clock is the top bar's alone.
    expect(main().querySelector('header')?.textContent).not.toContain('Feb 13 · 10:30');
    expect(within(bar).getByTestId('live-clock').textContent).toContain('Feb 13 · 10:30');
  });

  it('keeps the selected profile’s reading', async () => {
    await replayAt('/signals?profile=covid-19');
    const reading = within(topBar()).getByTestId('profile-reading');
    expect(reading.getAttribute('aria-label')).toMatch(/^Selected profile: COVID-19, Critical, score 93 out of 100;/);
  });

  it('the bell lists alerts as links to Signals, with no Acknowledge control', async () => {
    await replayAt('/dashboard');
    const total = getProfileAlerts(5).length;
    const bell = within(topBar()).getByRole('button', { name: /^Notifications:/ });
    fireEvent.click(bell);
    expect(bell.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByTestId('alerts-menu');
    expect(within(menu).queryByRole('button', { name: /Acknowledge/ })).toBeNull();
    expect(menu.textContent).not.toMatch(/Fri, Nov|Nov 7/);
    const items = within(menu).getAllByRole('listitem');
    expect(items).toHaveLength(total);
    for (const item of items) {
      const link = within(item).getByRole('link');
      expect(link.getAttribute('href')).toMatch(/^\/signals\?profile=[a-z0-9-]+$/);
      expect(link.textContent).toMatch(/ — .+detected Day \d · (awaiting acknowledgement|acknowledged)$/);
    }
    expect(within(menu).getByRole('link', { name: 'Review alerts in Signals' }).getAttribute('href')).toBe('/signals?profile=all');
    // Escape closes it; the bell stays reachable.
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByTestId('alerts-menu')).toBeNull();
    // A bell item opens that profile's queue.
    fireEvent.click(bell);
    fireEvent.click(within(screen.getByTestId('alerts-menu')).getAllByRole('link', { name: /^Critical COVID-19 — / })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Signals & Alerts' }, WAIT)).toBeTruthy();
    expect((screen.getByLabelText('Surveillance profile') as HTMLSelectElement).value).toBe('covid-19');
  });
});

describe('profile selector', () => {
  it('names each profile, grouped by type, without scores or severities', async () => {
    await replayAt('/dashboard');
    const select = screen.getByLabelText('Surveillance profile') as HTMLSelectElement;
    for (const profile of PROFILES) {
      const option = select.querySelector(`option[value="${profile.id}"]`) as HTMLOptionElement;
      expect(option.textContent).toBe(profile.displayName);
      expect((option.parentElement as HTMLOptGroupElement).label).toBe(
        profile.type === 'Aggregate' ? 'Aggregate profiles' : 'Pathogen-specific profiles',
      );
    }
    expect(select.textContent).not.toMatch(/Critical|High|Moderate|Watch|Low|Insufficient|No current data| — | \d+/);
    fireEvent.change(select, { target: { value: 'covid-19' } });
    expect((screen.getByLabelText('Surveillance profile') as HTMLSelectElement).value).toBe('covid-19');
    expect(screen.getByTestId('profile-heading').textContent).toContain('COVID-19');
  });
});

describe('Dashboard map', () => {
  it('is a summary: no Reset view, one way to the Outbreak Map', async () => {
    await replayAt('/dashboard');
    const geography = screen.getByRole('region', { name: 'Geographic summary' });
    expect(within(geography).queryByRole('button', { name: /Reset view/ })).toBeNull();
    expect(within(geography).queryByRole('button', { name: /View details|Open map/ })).toBeNull();
    const links = within(geography).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Open Outbreak Map →']);
    expect(links[0].getAttribute('href')).toBe('/map?profile=respiratory-viral-syndrome');
    expect(geography.textContent?.match(/synthetic/gi)).toHaveLength(1);
    // The Phase B structure is unchanged.
    expect(screen.getByTestId('score-and-confidence')).toBeTruthy();
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(5);
    expect(screen.getByTestId('alert-summary')).toBeTruthy();
  });
});

describe('Signals is the alert queue', () => {
  it('has the queue counts and the table, without the Dashboard’s score, scope or current figures', async () => {
    await replayAt('/signals?profile=all');
    const text = main().textContent ?? '';
    expect(text).not.toMatch(/Current composite score|Current scope|Current regional figures/);
    const counts = screen.getByTestId('queue-counts');
    const alerts = getProfileAlerts(5);
    expect(within(counts).getByText('Alerts awaiting acknowledgement')).toBeTruthy();
    expect(counts.textContent).toContain(`${alerts.length}of ${alerts.length} alerts detected so far`);
    expect(within(counts).getByText('Detected on this day')).toBeTruthy();
    expect(counts.textContent).not.toMatch(/Nov|Day \d/);
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Detected', 'Profile', 'Alert', 'Score', 'Severity', 'Acknowledgement', 'Review', 'Actions']);
    expect(within(table).getAllByRole('row')).toHaveLength(alerts.length + 1);
    // The score column carries the score; the description does not repeat it.
    expect(table.textContent).not.toMatch(/Composite Score: \d+/);
    expect(within(table).getAllByText(/out of 100 at detection/).length).toBe(alerts.length);
    expect(within(table).getAllByRole('button', { name: /^Acknowledge alert:/ })).toHaveLength(alerts.length);
    expect(within(table).getAllByRole('button', { name: /^Investigate alert:/ })).toHaveLength(alerts.length);
    // One small link instead: the profile shown, on the Dashboard.
    const figures = screen.getByTestId('current-figures-link');
    expect(figures.textContent).toMatch(/^Current figures for COVID-19 are on the Dashboard\./);
    expect(within(figures).getByRole('link', { name: 'View profile on Dashboard' }).getAttribute('href')).toBe('/dashboard?profile=covid-19');
  });

  it('keeps the narrated profile’s single-profile table, with its descriptions, and acknowledgement', async () => {
    await replayAt('/signals');
    const table = screen.getByRole('table');
    // The Score column carries the regional alert's score; its description does not repeat it.
    expect(within(table).getByRole('columnheader', { name: 'Score' })).toBeTruthy();
    expect(table.textContent).not.toContain('Composite Score: 74');
    expect(table.textContent).toContain('+24% vs baseline');
    const ack = within(table).getAllByRole('button', { name: /^Acknowledge alert:/ })[0];
    fireEvent.click(ack);
    expect(screen.getByRole('button', { name: /^Notifications:/ }).getAttribute('aria-label')).toContain('14 alerts');
    expect(within(screen.getByTestId('current-figures-link')).getByRole('link', { name: 'Investigate current conditions' }).getAttribute('href')).toBe(
      '/investigations?profile=respiratory-viral-syndrome&view=current',
    );
  });

  it('Live: the acknowledgement log names the live date, not a scenario timestamp', { timeout: 20000 }, async () => {
    await liveAt(/^Signals/, /Signals/);
    fireEvent.click(within(screen.getByRole('table')).getAllByRole('button', { name: /^Acknowledge alert:/ })[0]);
    const log = screen.getByText('Acknowledgement log').closest('section, div.ls-card') as HTMLElement;
    expect(log.textContent).toMatch(/Acknowledged on Feb \d+/);
    expect(log.textContent).not.toMatch(/scenario time|Day \d/);
    expect(main().textContent).not.toMatch(/Current composite score|Current scope|Current regional figures/);
  });
});
