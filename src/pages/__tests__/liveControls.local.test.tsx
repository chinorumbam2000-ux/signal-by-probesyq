// @vitest-environment jsdom
/**
 * One control starts Live Surveillance: "Start Live Surveillance", in the
 * Dashboard's header, with Reset and the compact Speed selector. The top bar shows no run state; the
 * Dashboard's context selector changes context but never starts playback;
 * the former /live address opens the Dashboard.
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
  it('exists only on the Dashboard, with a meaningful name', { timeout: 40000 }, async () => {
    for (const route of ['/map', '/facilities', '/laboratory-data', '/analytics', '/signals', '/investigations', '/reports', '/overview']) {
      window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
      const view = renderAt(route);
      await screen.findByRole('heading', { level: 1 }, WAIT);
      expect(startButtons().map((b) => b.textContent), route).toEqual([]);
      view.unmount();
    }
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    const starts = startButtons();
    expect(starts).toHaveLength(1);
    // The accessible name is the words alone; the ▶ glyph is decorative.
    expect(screen.getByRole('button', { name: 'Start Live Surveillance' })).toBe(starts[0]);
    expect(starts[0].textContent).toBe('▶ Start Live Surveillance');
    expect(starts[0].className).toContain('ls-btn-primary');
    expect(starts[0].closest('[role=group]')?.getAttribute('aria-label')).toBe('Live simulation controls');
    // In the Dashboard's header, not in the Live strip.
    expect(starts[0].closest('header')?.querySelector('h1')?.textContent).toBe('Regional Outbreak Status');
    expect(screen.getByTestId('dashboard-live').contains(starts[0])).toBe(false);
  });

  it('the top bar shows neither playback controls nor the run state; the Live page keeps the run state', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    const bar = topBar();
    const RUN = /Not started|Running · \d×|Paused|Complete|Live simulation/;
    const sources = () => screen.getByTestId('source-status').textContent;
    expect(within(bar).queryAllByRole('button').filter((b) => /start|pause|resume|reset|×$/i.test(b.textContent ?? ''))).toEqual([]);
    expect(within(bar).queryByTestId('live-run-status')).toBeNull();
    expect(bar.textContent).not.toMatch(RUN);
    expect(sources()).toContain('Sources · not started');
    fireEvent.click(button('Start Live Surveillance'));
    expect(topBar().textContent).not.toMatch(RUN);
    expect(sources()).toContain('3 / 3 sources active');
    fireEvent.click(button('❚❚ Pause'));
    expect(topBar().textContent).not.toMatch(RUN);
    expect(sources()).toContain('Sources · paused');
    expect(screen.getByRole('button', { name: '▶ Resume' })).toBeTruthy();
    expect(within(topBar()).queryAllByRole('button').filter((b) => /start|pause|resume|reset/i.test(b.textContent ?? ''))).toEqual([]);
  });

  it('the Dashboard\'s Live strip: the run state, the detail in three collapsed cards; the controls are in the header', async () => {
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    const live = screen.getByTestId('dashboard-live');
    expect(screen.getByTestId('dashboard-live-status').textContent).toBe('Live Surveillance · Not started · 3 / 3 sources ready');
    // The one control group is in the header; the strip holds no playback control.
    expect(screen.getAllByRole('group', { name: 'Live simulation controls' })).toHaveLength(1);
    expect(within(live).queryByRole('group', { name: 'Live simulation controls' })).toBeNull();
    expect(within(live).queryAllByRole('button')).toEqual([]);
    expect(startButtons()).toHaveLength(1);
    // The operational detail is there, collapsed; the test tools and How this works are under System.
    for (const id of ['live-sources', 'live-today', 'live-activity']) {
      const section = within(live).getByTestId(id) as HTMLDetailsElement;
      expect(section.tagName, id).toBe('DETAILS');
      expect(section.open, id).toBe(false);
    }
    expect(screen.queryByTestId('inject')).toBeNull();
    expect(screen.queryByTestId('live-how-it-works')).toBeNull();
    expect(within(live).getByTestId('source-status').textContent).toMatch(/FHIR R4/);
  });

  it('the former /live address opens the Dashboard in Live Surveillance, without starting it', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    renderAt('/live?profile=covid-19');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    expect(screen.getByRole('heading', { level: 1, name: 'Regional Outbreak Status' })).toBeTruthy();
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('live');
    expect((screen.getByLabelText('Surveillance profile') as HTMLSelectElement).value).toBe('covid-19');
    const clock = screen.getAllByTestId('live-clock')[0].textContent;
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 10);
    });
    expect(screen.getAllByTestId('live-clock')[0].textContent).toBe(clock); // the simulated clock stands still
    expect(screen.getByTestId('source-status').getAttribute('data-run-state')).toBe('idle');
    expect(screen.queryByRole('button', { name: '❚❚ Pause' })).toBeNull();
  });

  it('the Dashboard\'s context selector changes context but does not start playback', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    renderAt('/dashboard');
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    vi.useFakeTimers();
    expect(screen.queryByTestId('dashboard-live')).toBeNull();
    const group = screen.getByRole('group', { name: 'Surveillance context' });
    fireEvent.click(within(group).getByRole('button', { name: 'Live Surveillance' }));
    expect(window.sessionStorage.getItem(MODE_STORAGE_KEY)).toBe('live');
    expect(screen.getByTestId('dashboard-live-status').getAttribute('data-run-state')).toBe('idle');
    const clock = screen.getAllByTestId('live-clock')[0].textContent;
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 10);
    });
    expect(screen.getAllByTestId('live-clock')[0].textContent).toBe(clock); // the simulated clock stands still
    expect(screen.getByTestId('dashboard-live-status').textContent).toContain('Not started');
  });

  it('Start, then Pause / Resume / Reset and the speeds, all in the same place', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'live');
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    const controls = () => screen.getByRole('group', { name: 'Live simulation controls' });
    const names = () => within(controls()).getAllByRole('button').map((b) => b.textContent);
    expect(names()).toEqual(['▶ Start Live Surveillance', '↺ Reset', 'Speed: 1×']);
    fireEvent.click(within(controls()).getByRole('button', { name: 'Start Live Surveillance' }));
    expect(names()).toEqual(['❚❚ Pause', '↺ Reset', 'Speed: 1×']);
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(within(controls()).getByRole('button', { name: 'Speed: 1×' }));
    fireEvent.click(within(controls()).getByRole('button', { name: '2×' }));
    expect(names()).toEqual(['❚❚ Pause', '↺ Reset', 'Speed: 2×']);
    // Moving focus in and out of the speed list queues React's own zero-delay work; flush it, then count.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(vi.getTimerCount()).toBe(1); // still exactly one playback timer
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

  it('points to the one button, on the Dashboard', () => {
    for (const q of ['How do I start Live Surveillance?', 'How do I start the live simulation?', 'Where is the Start button?', 'How can I begin the live feeds?']) {
      const a = ask(q, liveCtx({ started: false, playing: false }));
      expect(a.intent, q).toBe('mode_start');
      expect(a.text).toContain('On the Dashboard');
      expect(a.text).toContain('press Start Live Surveillance in the Live Surveillance controls at the top');
      expect(a.text).toContain('They are the only ones: the rest of the app shows the live data but never starts or stops it.');
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
