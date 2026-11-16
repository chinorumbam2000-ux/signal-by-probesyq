// @vitest-environment jsdom
/**
 * Live Surveillance in the app (local/static mode): the mode switch,
 * playback, the one timer, and every analyst view following the live state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { MODE_STORAGE_KEY, MINUTES_PER_TICK, TICK_MS } from '../../context/LiveSurveillanceContext';
import { OPERATING_MINUTES } from '../../lib/live/dataset';
import { signInForTest } from './signedIn';
import { chooseSpeed } from './liveSpeed';

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
/** Simulated operating minutes -> fake-timer milliseconds at the given speed. */
const play = (minutes: number, speed = 1) =>
  act(() => {
    vi.advanceTimersByTime(Math.ceil(minutes / (MINUTES_PER_TICK * speed)) * TICK_MS);
  });
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0];

describe('Live Surveillance', () => {
  it('opens in Live Surveillance by default, and the Dashboard\'s context selector persists for the session', async () => {
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', {}, WAIT);
    const group = screen.getByRole('group', { name: 'Surveillance context' });
    expect(within(group).getByRole('button', { name: 'Live Surveillance' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: 'Scenario Replay' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('dashboard-live')).toBeTruthy();
    expect(document.querySelector('header')?.textContent).toContain('Live Surveillance · Simulated source feeds');
    fireEvent.click(within(group).getByRole('button', { name: 'Scenario Replay' }));
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('replay');
    expect(screen.queryByTestId('dashboard-live')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Live Surveillance' }));
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('live');
    expect(screen.getByTestId('dashboard-live')).toBeTruthy();
    // Never the old labels.
    expect(document.body.textContent).not.toMatch(/Demo Environment|Classroom Demo/);
  });

  it('explains the product to a first-time visitor beside the one Start control, and can be dismissed', async () => {
    const view = renderAt('/dashboard');
    const strip = await screen.findByTestId('start-here', undefined, WAIT);
    expect(within(strip).queryByRole('link', { name: /Live Surveillance|Scenario Replay/ })).toBeNull();
    // The one Start control is the Dashboard's Live strip; starting it retires the introduction.
    expect(screen.getAllByRole('button', { name: 'Start Live Surveillance' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Start Live Surveillance' }));
    expect(screen.queryByTestId('start-here')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '❚❚ Pause' }));
    view.unmount();
    window.sessionStorage.removeItem('labsentinel.surveillanceMode.v1');
    renderAt('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss the introduction' }, WAIT));
    expect(screen.queryByTestId('start-here')).toBeNull();
    expect(window.sessionStorage.getItem('labsentinel.startHere.dismissed.v1')).toBe('1');
  });

  it('never shows the replay-narrated EHR sidecar beside live figures', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/integration-demo');
    expect(await screen.findByTestId('sidecar-live-note', undefined, WAIT)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Respiratory Viral Activity · regional activity');
  });

  it('starts, pauses, resumes and resets — with exactly one timer', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    expect(within(screen.getByTestId('activity-stream')).getByText(/No activity yet/)).toBeTruthy();
    const sources = () => screen.getByTestId('source-status');
    expect(sources().getAttribute('data-run-state')).toBe('idle');
    // The page and top bar say the sources are simulated; the panel does not repeat it.
    expect(sources().textContent).toContain('Sources · not started');
    expect(sources().textContent).not.toContain('Active');
    fireEvent.click(button('Start Live Surveillance'));
    expect(vi.getTimerCount()).toBe(1);
    play(120);
    expect(sources().textContent).toContain('3 / 3 sources active');
    const stream = screen.getByTestId('activity-stream');
    expect(within(stream).getAllByText(/Observation received/).length).toBeGreaterThan(0);
    fireEvent.click(button('❚❚ Pause'));
    expect(vi.getTimerCount()).toBe(0);
    expect(sources().textContent).toContain('paused (3 / 3 active when paused)');
    expect(sources().textContent).toContain('Active · paused');
    const frozen = stream.textContent;
    play(600);
    expect(screen.getByTestId('activity-stream').textContent).toBe(frozen);
    fireEvent.click(button('▶ Resume'));
    fireEvent.click(button('❚❚ Pause'));
    fireEvent.click(button('▶ Resume'));
    expect(vi.getTimerCount()).toBe(1);
    play(60);
    fireEvent.click(button('↺ Reset'));
    expect(vi.getTimerCount()).toBe(0);
    expect(within(screen.getByTestId('activity-stream')).getByText(/No activity yet/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Start Live Surveillance' }).length).toBeGreaterThan(0);
  });

  it('updates every analyst view as observations arrive, and COVID-19 rises to the top', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    chooseSpeed(4);
    fireEvent.click(button('Start Live Surveillance'));
    play(OPERATING_MINUTES * 8 + 30, 4);
    fireEvent.click(button('❚❚ Pause'));
    vi.useRealTimers();

    // Dashboard: Active Surveillance from the live closed day (Feb 15), COVID-19 first.
    fireEvent.click(screen.getAllByRole('link', { name: /Dashboard/ })[0]);
    const section = await screen.findByTestId('active-surveillance', {}, WAIT);
    expect(screen.getByText('Live Surveillance · signals for Feb 15 (latest closed day)')).toBeTruthy();
    const cards = within(within(section).getByRole('list', { name: 'Active signals' })).getAllByRole('heading', { level: 3 });
    expect(cards[0].textContent).toBe('COVID-19');
    expect(within(screen.getByTestId('profile-card-covid-19')).getByText('87')).toBeTruthy();
    expect(screen.getByTestId('today-covid-19').textContent).toMatch(/Today so far \(provisional\)/);
    // Cholera is not in the live feeds: never an active card.
    expect(screen.queryByTestId('profile-card-cholera')).toBeNull();
    // Top bar: the live clock.
    expect(screen.getByTestId('live-clock').textContent).toMatch(/^Feb 16 · \d{2}:\d{2}/);

    // Map, Facilities, Laboratory Data and Analytics follow the live closed day.
    fireEvent.click(screen.getAllByRole('link', { name: /Outbreak Map/ })[0]);
    await screen.findByRole('heading', { level: 1, name: 'Outbreak Map' }, WAIT);
    expect(screen.getByText('Live Surveillance · Feb 15 (latest closed day)')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: /Facilities/ })[0]);
    await screen.findByRole('heading', { level: 1, name: 'Facilities' }, WAIT);
    expect(screen.getByText('Tests — Feb 15')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: /Laboratory Data/ })[0]);
    await screen.findByTestId('lab-profile-note', {}, WAIT);
    expect(screen.getByTestId('lab-profile-note').textContent).toContain('Live Surveillance');
    expect(await screen.findByText(/received on Feb 16/, {}, WAIT)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: /Analytics/ })[0]);
    await screen.findByText(/Closed days through Feb 15/, {}, WAIT);
  });

  it('sends a synthetic test observation through the same pipeline (no way to set a score), from System → Integration Demo', async () => {
    renderAt('/integration-demo');
    await screen.findByRole('heading', { level: 1, name: 'Integration Demo' }, WAIT);
    const inject = screen.getByTestId('inject');
    expect(within(inject).getByRole('heading', { name: 'Test tools: inject a synthetic test observation' })).toBeTruthy();
    expect(within(inject).queryByLabelText(/score/i)).toBeNull();
    fireEvent.change(within(inject).getByLabelText('Facility'), { target: { value: 'HOSP-B' } });
    fireEvent.click(within(inject).getByLabelText('Negative'));
    fireEvent.click(within(inject).getByRole('button', { name: 'Send test observation' }));
    expect(within(inject).getByRole('status').textContent).toMatch(/^Sent: SARS-CoV-2 RNA, negative, from .+ \(HL7 v2\)\.$/);
    // The same Live state: the Dashboard's activity stream records it.
    fireEvent.click(screen.getAllByRole('link', { name: /^Dashboard/ })[0]);
    await screen.findByTestId('dashboard-live', undefined, WAIT);
    expect(screen.getByTestId('activity-stream').textContent).toContain('synthetic test observation');
    expect(screen.getByTestId('live-activity-summary').textContent).toMatch(/^Latest: /);
    expect(screen.queryByTestId('inject')).toBeNull();
  });

  it('leaves Scenario Replay untouched', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/replay');
    await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT);
    // Visiting the replay switches back to it; its controls and data are the replay's.
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('replay');
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getAllByRole('button', { name: 'Next replay day' })[0]);
    expect(screen.getByTestId('profile-reading').getAttribute('aria-label')).toMatch(/^Replay profile: Respiratory Viral Activity, Critical;/);
    expect(screen.getByTestId('replay-current-state').textContent).toContain('87 / 100');
  });
});
