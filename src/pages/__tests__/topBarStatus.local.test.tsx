// @vitest-environment jsdom
/**
 * The top bar carries context, not readings: no Live run state and no
 * numeric score — not on screen, not in screen-reader text, labels or
 * tooltips. The profile's name and severity stay; the score and the run
 * state stay where they belong (Dashboard, Current State, the Live page).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
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
  vi.unstubAllGlobals();
});

const WAIT = { timeout: 5000 };
const topBar = () => screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
/** Everything the top bar says, to sight or to assistive technology. */
const everything = (bar: HTMLElement) =>
  [bar.textContent ?? '', ...[...bar.querySelectorAll('[aria-label], [title]')].map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`)].join(' ');
const SCORE = /\b\d{1,3}\s*\/\s*100\b|out of 100|\bscore\b/i;
const RUN = /Not started|Running · \d×|\bPaused\b|\bComplete\b|Live simulation/;

describe('top bar: no run state, no numeric score', () => {
  it('Live Surveillance: the clock, the disclosure, the severity — no run state or score anywhere in the bar', async () => {
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', {}, WAIT);
    const bar = topBar();
    const said = everything(bar);
    expect(said).not.toMatch(RUN);
    expect(said).not.toMatch(SCORE);
    expect(within(bar).getByTestId('live-clock')).toBeTruthy();
    expect(within(bar).getByTestId('mode-disclosure').textContent).toContain('Simulated source feeds');
    const reading = within(bar).getByTestId('profile-reading');
    expect(reading.getAttribute('aria-label')).toMatch(/^Selected profile: Respiratory Viral Activity, \w+;/);
    expect(within(reading).getByText('Respiratory')).toBeTruthy();
    // The run state stays on the Dashboard's status line and the Live page.
    expect(screen.getByTestId('dashboard-live-status').textContent).toContain('Not started');
  });

  it('Scenario Replay: day, date, controls, profile and severity — no score; the page keeps the score', async () => {
    chooseScenarioReplayForTest();
    saveSession({ day: 5, acknowledgements: {}, investigations: {}, reports: [] });
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', {}, WAIT);
    const bar = topBar();
    expect(everything(bar)).not.toMatch(SCORE);
    expect(everything(bar)).not.toMatch(RUN);
    expect(within(bar).getByTestId('replay-day').textContent).toMatch(/^Day 5 of 5\s*Fri, Nov 7, 2025/);
    for (const name of ['Previous replay day', 'Next replay day', 'Reset Scenario Replay to Day 1']) {
      expect(within(bar).getByRole('button', { name })).toBeTruthy();
    }
    const reading = within(bar).getByTestId('profile-reading');
    expect(reading.textContent).toBe('RespiratoryCritical');
    expect(reading.getAttribute('aria-label')).toMatch(/^Selected profile: Respiratory Viral Activity, Critical; \d+ alerts? awaiting acknowledgement$/);
    expect(reading.getAttribute('title')).toBe(reading.getAttribute('aria-label'));
    expect(within(bar).getByRole('button', { name: /^Notifications:/ })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: /^Sign Out/ })).toBeTruthy();
    // The Dashboard's Outbreak Score is untouched.
    expect(screen.getByTestId('outbreak-score').textContent).toContain('87');
    cleanup();
    renderAt('/replay');
    await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT);
    expect(everything(topBar())).not.toMatch(SCORE);
    expect(screen.getByTestId('replay-current-state').textContent).toContain('87 / 100');
  });

  it('an unscored profile still shows its status in words', async () => {
    chooseScenarioReplayForTest();
    saveSession({ day: 5, acknowledgements: {}, investigations: {}, reports: [] });
    renderAt('/dashboard?profile=cholera');
    await screen.findByTestId('active-surveillance', {}, WAIT);
    expect(within(topBar()).getByTestId('profile-reading').textContent).toBe('CholeraInsufficient baseline');
  });

  it('the Live page keeps its run state in its own content', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    expect(everything(topBar())).not.toMatch(RUN);
    expect(screen.getByTestId('source-status').textContent).toContain('Sources · not started');
    expect(screen.getByRole('button', { name: 'Start Live Surveillance' })).toBeTruthy();
  });
});
