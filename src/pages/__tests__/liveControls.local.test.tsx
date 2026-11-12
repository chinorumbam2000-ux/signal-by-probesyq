// @vitest-environment jsdom
/**
 * One control starts Live Surveillance: "Start Live Surveillance", on the Live
 * Surveillance page. The top bar and the Dashboard show the live state only;
 * the Start here link and the sidebar's mode switch navigate, never start.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { MINUTES_PER_TICK, MODE_STORAGE_KEY, TICK_MS } from '../../context/LiveSurveillanceContext';
import { signInForTest } from './signedIn';
import { answerQuestion, answerText } from '../../assistant/answerEngine';
import { buildLiveAssistantContext } from '../../assistant/liveContext';
import { LiveSimulator } from '../../lib/live/simulator';
import { liveSummaries } from '../../lib/live/view';

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
const START = /\bstart\b/i;
/** Every button whose accessible name says Start, anywhere on the screen. */
const startButtons = () => screen.queryAllByRole('button').filter((b) => START.test(b.textContent ?? '') || START.test(b.getAttribute('aria-label') ?? ''));
const topBar = () => screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0];

describe('one Start control for Live Surveillance', () => {
  it('exists only on the Live Surveillance page, with a meaningful name', { timeout: 40000 }, async () => {
    for (const route of ['/dashboard', '/map', '/facilities', '/laboratory-data', '/analytics', '/signals', '/investigations', '/reports', '/overview']) {
      window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
      const view = renderAt(route);
      await screen.findByRole('heading', { level: 1 }, WAIT);
      expect(startButtons().map((b) => b.textContent), route).toEqual([]);
      view.unmount();
    }
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    const starts = startButtons();
    expect(starts).toHaveLength(1);
    // The accessible name is the words alone; the ▶ glyph is decorative.
    expect(screen.getByRole('button', { name: 'Start Live Surveillance' })).toBe(starts[0]);
    expect(starts[0].textContent).toBe('▶ Start Live Surveillance');
    expect(starts[0].className).toContain('ls-btn-primary');
    expect(starts[0].closest('[role=group]')?.getAttribute('aria-label')).toBe('Live simulation controls');
  });

  it('the top bar shows the live state only — no playback control', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    const bar = topBar();
    const status = () => within(topBar()).getByTestId('live-run-status').textContent;
    expect(within(bar).queryAllByRole('button').filter((b) => /start|pause|resume|reset|×$/i.test(b.textContent ?? ''))).toEqual([]);
    expect(status()).toBe('Live simulation: Not started');
    fireEvent.click(button('Start Live Surveillance'));
    expect(status()).toBe('Live simulation: Running · 1×');
    fireEvent.click(button('❚❚ Pause'));
    expect(status()).toBe('Live simulation: Paused');
    expect(within(topBar()).queryAllByRole('button').filter((b) => /start|pause|resume|reset/i.test(b.textContent ?? ''))).toEqual([]);
  });

  it('the Dashboard has no playback controls: ready text, a link to the page, and the live state', async () => {
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    const live = screen.getByTestId('dashboard-live');
    expect(within(live).queryAllByRole('button')).toEqual([]);
    expect(screen.getByTestId('live-ready').textContent).toContain('Open Live Surveillance to begin receiving simulated source observations');
    expect(within(live).getByRole('link', { name: 'Open Live Surveillance →' }).getAttribute('href')).toBe('/live');
    expect(startButtons()).toEqual([]);
  });

  it('the Start here link only navigates — the simulation does not start', async () => {
    renderAt('/dashboard');
    const strip = await screen.findByTestId('start-here', undefined, WAIT);
    vi.useFakeTimers();
    const cta = within(strip).getByRole('link', { name: 'Open Live Surveillance' });
    expect(within(strip).queryAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Dismiss the introduction']);
    fireEvent.click(cta);
    expect(screen.getByRole('heading', { level: 1, name: 'Live Surveillance' })).toBeTruthy();
    const clock = screen.getAllByTestId('live-clock')[0].textContent;
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 10);
    });
    expect(screen.getAllByTestId('live-clock')[0].textContent).toBe(clock); // the simulated clock stands still
    expect(within(topBar()).getByTestId('live-run-status').textContent).toBe('Live simulation: Not started');
    expect(screen.getByRole('button', { name: 'Start Live Surveillance' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '❚❚ Pause' })).toBeNull();
    expect(screen.getByText(/No activity yet/)).toBeTruthy();
  });

  it('the sidebar mode switch changes mode but does not start playback', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    vi.useFakeTimers();
    const group = screen.getAllByRole('group', { name: 'Surveillance mode' })[0];
    fireEvent.click(within(group).getByRole('button', { name: 'Live Surveillance' }));
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('live');
    expect(screen.getByTestId('live-ready')).toBeTruthy();
    const clock = screen.getAllByTestId('live-clock')[0].textContent;
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 10);
    });
    expect(screen.getAllByTestId('live-clock')[0].textContent).toBe(clock); // the simulated clock stands still
    expect(within(topBar()).getByTestId('live-run-status').textContent).toBe('Live simulation: Not started');
  });

  it('Start, then Pause / Resume / Reset and the speeds, all in the same place', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    const controls = () => screen.getByRole('group', { name: 'Live simulation controls' });
    const names = () => within(controls()).getAllByRole('button').map((b) => b.textContent);
    expect(names()).toEqual(['▶ Start Live Surveillance', '↺ Reset', '1×', '2×', '4×']);
    fireEvent.click(within(controls()).getByRole('button', { name: 'Start Live Surveillance' }));
    expect(names()).toEqual(['❚❚ Pause', '↺ Reset', '1×', '2×', '4×']);
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(within(controls()).getByRole('button', { name: '2×' }));
    expect(within(controls()).getByRole('button', { name: '2×' }).getAttribute('aria-pressed')).toBe('true');
    expect(vi.getTimerCount()).toBe(1);
    const clock = () => screen.getAllByTestId('live-clock')[0].textContent;
    const before = clock();
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 4); // 4 steps of 2 × 15 minutes = 2 simulated hours
    });
    expect(clock()).not.toBe(before);
    fireEvent.click(within(controls()).getByRole('button', { name: '❚❚ Pause' }));
    expect(names()[0]).toBe('▶ Resume');
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(within(controls()).getByRole('button', { name: '▶ Resume' }));
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(within(controls()).getByRole('button', { name: '↺ Reset' }));
    expect(vi.getTimerCount()).toBe(0);
    expect(names()[0]).toBe('▶ Start Live Surveillance');
    expect(MINUTES_PER_TICK).toBe(15);
  });
});

describe('Roella: how to start Live Surveillance', () => {
  const ask = (q: string, ctx: Parameters<typeof answerQuestion>[1]) => {
    const a = answerQuestion(q, ctx).answer;
    return { intent: a.intent, text: answerText(a) };
  };
  const liveCtx = (state: { started: boolean; playing: boolean }) => {
    const sim = new LiveSimulator();
    return { day: 5 as const, route: 'dashboard' as const, profiles: liveSummaries(sim), live: buildLiveAssistantContext(sim, state) };
  };

  it('points to the one button on the Live Surveillance page', () => {
    for (const q of ['How do I start Live Surveillance?', 'How do I start the live simulation?', 'Where is the Start button?', 'How can I begin the live feeds?']) {
      const a = ask(q, liveCtx({ started: false, playing: false }));
      expect(a.intent, q).toBe('mode_start');
      expect(a.text).toContain('Open the Live Surveillance page');
      expect(a.text).toContain('press Start Live Surveillance');
      expect(a.text).toContain('The Dashboard and the top bar show the live state, but do not start or stop it.');
      expect(a.text).toContain('It has not started yet.');
    }
  });

  it('says what state it is in now, in either mode', () => {
    expect(ask('How do I start Live Surveillance?', liveCtx({ started: true, playing: true })).text).toContain('It is running now.');
    expect(ask('How do I start Live Surveillance?', liveCtx({ started: true, playing: false })).text).toContain('It is paused now');
    const replay = ask('How do I start Live Surveillance?', { day: 3, route: 'dashboard' });
    expect(replay.intent).toBe('mode_start');
    expect(replay.text).toContain('it does not start on its own');
  });

  it('leaves other questions alone', () => {
    const ctx = liveCtx({ started: true, playing: true });
    expect(ask('Is this real-time?', ctx).intent).toBe('realtime');
    expect(ask('What just changed?', ctx).intent).not.toBe('mode_start');
    expect(ask('Are all sources active?', ctx).intent).toBe('live_sources');
    expect(ask('What is the main mode?', ctx).intent).toBe('mode_main');
  });
});
