// @vitest-environment jsdom
/**
 * The Dashboard is the operational home. The sidebar lists pages only (no
 * Live Surveillance or Scenario Replay items, no mode switch); Live
 * Surveillance is the Dashboard's default context, with its one control group
 * there; Scenario Replay is chosen with the Dashboard's context selector and
 * keeps its timeline at /replay. /live opens the Dashboard in Live context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../../App';
import { MODE_STORAGE_KEY } from '../../context/LiveSurveillanceContext';
import { answerQuestion, answerText } from '../../assistant/answerEngine';
import { getScoreForDay } from '../../lib/selectors';
import { signInForTest } from './signedIn';

vi.mock('../../components/map/OutbreakMap', () => ({
  default: () => <div data-testid="outbreak-map" />,
}));

let lastPath = '';
function LocationProbe() {
  const location = useLocation();
  lastPath = `${location.pathname}${location.search}${location.hash}`;
  return null;
}

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
  vi.unstubAllGlobals();
});

const WAIT = { timeout: 5000 };
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
const primaryNavs = () => screen.getAllByRole('navigation', { name: 'Primary' });
const context = () => screen.getByRole('group', { name: 'Surveillance context' });
const pressed = (name: string) => within(context()).getByRole('button', { name }).getAttribute('aria-pressed');

/** The visible structure of one sidebar: each group's name and its links. */
function structure(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('group')
    .filter((group) => group.getAttribute('aria-label') !== 'System')
    .map((group) => [group.getAttribute('aria-label'), within(group).getAllByRole('link').map((a) => a.textContent?.replace(/\d+$/, '').replace(/^[^A-Za-z]+/, '').trim())]);
}

const EXPECTED = [
  ['Overview', ['Dashboard']],
  ['Surveillance', ['Outbreak Map', 'Signals', 'Facilities', 'Laboratory Data', 'Analytics']],
  ['Action', ['Investigations', 'Reports']],
];

describe('NAVIGATION: the sidebar lists pages, not modes', () => {
  it('Overview · Surveillance · Action, System collapsed, About this data at the bottom', async () => {
    renderAt('/signals');
    await screen.findByRole('heading', { level: 1, name: /Signals/ }, WAIT);
    const nav = primaryNavs()[0];
    expect(structure(nav)).toEqual(EXPECTED);
    const system = within(nav).getByRole('group', { name: 'System' });
    expect(within(system).getByRole('button', { name: /System/ }).getAttribute('aria-expanded')).toBe('false');
    expect(within(system).queryAllByRole('link')).toEqual([]);
    expect(within(nav).getByRole('link', { name: 'About this data' })).toBeTruthy();
    expect(within(nav).queryByRole('group', { name: /Surveillance (mode|context)/ })).toBeNull();
    expect(nav.textContent).not.toMatch(/Live Surveillance|Scenario Replay|Historical training scenario|Current simulated feed/);
  });

  it('the mobile drawer carries the same simplified navigation', async () => {
    renderAt('/signals');
    await screen.findByRole('heading', { level: 1, name: /Signals/ }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const navs = primaryNavs();
    expect(navs).toHaveLength(2);
    expect(structure(navs[1])).toEqual(EXPECTED);
    expect(navs[1].textContent).not.toMatch(/Live Surveillance|Scenario Replay/);
    fireEvent.click(within(navs[1]).getByRole('link', { name: /^Dashboard/ }));
    await screen.findByRole('heading', { level: 1, name: 'Regional Outbreak Status' }, WAIT);
    expect(primaryNavs()).toHaveLength(1); // the drawer closes on navigation
  });
});

describe('LIVE: the Dashboard is the Live operational home', () => {
  it('opens in Live context with the one Start in the header, the strip and its collapsed detail', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    expect(pressed('Live Surveillance')).toBe('true');
    const live = screen.getByTestId('dashboard-live');
    expect(within(live).getByTestId('dashboard-live-status').textContent).toBe('Live Surveillance · Not started · 3 / 3 sources ready');
    const header = screen.getByRole('heading', { level: 1, name: 'Regional Outbreak Status' }).closest('header') as HTMLElement;
    expect(within(within(header).getByRole('group', { name: 'Live simulation controls' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '▶ Start Live Surveillance', '↺ Reset', 'Speed: 1×',
    ]);
    const titles = Array.from(live.querySelectorAll('details > summary')).map((s) => s.querySelector('.font-semibold')?.textContent);
    expect(titles).toEqual(['Source activity', 'Today so far', 'Activity stream']);
    expect(Array.from(live.querySelectorAll('details')).every((d) => !d.open)).toBe(true);
    expect(live.textContent).not.toMatch(/Test tools|How this works/);
    expect(screen.queryByTestId('dashboard-replay')).toBeNull();
  });

  it('/live redirects to the Dashboard in Live context, keeping the query and hash', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    renderAt('/live?profile=covid-19#sources');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    expect(lastPath).toBe('/dashboard?profile=covid-19#sources');
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('live');
    expect(pressed('Live Surveillance')).toBe('true');
    expect(screen.getByTestId('dashboard-live-status').getAttribute('data-run-state')).toBe('idle');
  });
});

describe('REPLAY: chosen on the Dashboard, the timeline kept at /replay', () => {
  it('the context selector switches the Dashboard to Scenario Replay, then opens the timeline', async () => {
    renderAt('/dashboard');
    await screen.findByTestId('dashboard-live', undefined, WAIT);
    fireEvent.click(within(context()).getByRole('button', { name: 'Scenario Replay' }));
    expect(pressed('Scenario Replay')).toBe('true');
    expect(screen.queryByTestId('dashboard-live')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start Live Surveillance' })).toBeNull();
    const strip = screen.getByTestId('dashboard-replay');
    expect(strip.textContent).toMatch(/Scenario Replay · Historical training scenario/);
    // The top bar's replay day controls are there.
    expect(screen.getByRole('button', { name: 'Next replay day' })).toBeTruthy();
    fireEvent.click(within(strip).getByRole('link', { name: 'Open the scenario timeline' }));
    await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT);
    expect(lastPath).toBe('/replay');
  });

  it('/replay still serves the timeline directly, and /simulation still redirects to it', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    const view = renderAt('/replay');
    expect(await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT)).toBeTruthy();
    view.unmount();
    renderAt('/simulation?x=1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT)).toBeTruthy();
    expect(lastPath).toBe('/replay?x=1');
    expect([1, 2, 3, 4, 5].map((day) => getScoreForDay(day as 1 | 2 | 3 | 4 | 5).composite)).toEqual([0, 24, 50, 74, 87]);
  });

  it('choosing Live on the Dashboard returns it to the Live strip without starting it', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    renderAt('/dashboard');
    await screen.findByTestId('dashboard-replay', undefined, WAIT);
    fireEvent.click(within(context()).getByRole('button', { name: 'Live Surveillance' }));
    expect(screen.getByTestId('dashboard-live-status').getAttribute('data-run-state')).toBe('idle');
    expect(lastPath).toBe('/dashboard');
  });
});

describe('STATE: the context persists for the session', () => {
  it('a chosen context survives a remount', async () => {
    const first = renderAt('/dashboard');
    await screen.findByTestId('dashboard-live', undefined, WAIT);
    fireEvent.click(within(context()).getByRole('button', { name: 'Scenario Replay' }));
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('replay');
    first.unmount();
    renderAt('/dashboard');
    await screen.findByTestId('dashboard-replay', undefined, WAIT);
    expect(pressed('Scenario Replay')).toBe('true');
  });

  it('the top bar shows neither a numeric score nor the run state', async () => {
    renderAt('/dashboard');
    await screen.findByTestId('dashboard-live', undefined, WAIT);
    const bar = screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
    expect(bar.textContent).not.toMatch(/Not started|Running|Paused|Complete|\b\d+\s*\/\s*100\b|Score/);
  });
});

describe('ROELLA: navigation answers follow the Dashboard', () => {
  const ask = (q: string) => answerText(answerQuestion(q, { day: 5, route: 'dashboard' }, {}).answer);

  it('points Live Surveillance, Scenario Replay and the Dashboard to the right place', () => {
    expect(ask('Where do I start Live Surveillance?')).toContain('press Start Live Surveillance in the Live Surveillance controls at the top');
    expect(ask('Where is Live Surveillance?')).toContain("Live Surveillance is the Dashboard's default context");
    expect(ask('Where is Scenario Replay?')).toContain("Switch the Dashboard's context selector to Scenario Replay");
    expect(ask('What is the Dashboard?')).toContain('operational home');
    for (const q of ['Where is Live Surveillance?', 'Where is Scenario Replay?', 'Where do I start Live Surveillance?']) {
      expect(ask(q), q).not.toMatch(/Open (Live Surveillance|Scenario Replay) in the sidebar/);
    }
  });
});
