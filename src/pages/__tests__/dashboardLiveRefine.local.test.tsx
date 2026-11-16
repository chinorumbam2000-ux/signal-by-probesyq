// @vitest-environment jsdom
/**
 * The Dashboard's Live Surveillance, refined: the one set of playback controls
 * sits in the Dashboard's header (Start / Pause / Resume, Reset and a compact
 * "Speed: 1×" selector); the Live strip keeps the run state and three
 * collapsed cards (Source activity, Today so far, Activity stream), each with
 * a one-line summary. The test tools moved to System → Integration Demo and
 * "How this works" to System → Architecture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { MODE_STORAGE_KEY, TICK_MS } from '../../context/LiveSurveillanceContext';
import { answerQuestion, answerText } from '../../assistant/answerEngine';
import { getScoreForDay } from '../../lib/selectors';
import { signInForTest } from './signedIn';

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
const dashboardHeader = () => screen.getByRole('heading', { level: 1, name: 'Regional Outbreak Status' }).closest('header') as HTMLElement;
const controls = () => screen.getByRole('group', { name: 'Live simulation controls' });
const speedButton = () => within(controls()).getByRole('button', { name: /^Speed: [124]×$/ });
const SPEED_NAME = /^[124]×$/;

describe('LIVE CONTROL LOCATION', () => {
  it('the controls are in the Dashboard header, beside the context selector; none in the Live strip', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    const header = dashboardHeader();
    expect(within(header).getByRole('group', { name: 'Surveillance context' })).toBeTruthy();
    expect(header.contains(controls())).toBe(true);
    const live = screen.getByTestId('dashboard-live');
    expect(within(live).queryAllByRole('button')).toEqual([]);
    expect(screen.getAllByRole('button', { name: 'Start Live Surveillance' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Reset$/ }).filter((b) => b.textContent === '↺ Reset')).toHaveLength(1);
  });

  it('only the stateful action shows: Start, then Pause, then Resume; Reset always', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    const names = () => within(controls()).getAllByRole('button').map((b) => b.textContent);
    expect(names()).toEqual(['▶ Start Live Surveillance', '↺ Reset', 'Speed: 1×']);
    fireEvent.click(within(controls()).getByRole('button', { name: 'Start Live Surveillance' }));
    expect(names()).toEqual(['❚❚ Pause', '↺ Reset', 'Speed: 1×']);
    fireEvent.click(within(controls()).getByRole('button', { name: '❚❚ Pause' }));
    expect(names()).toEqual(['▶ Resume', '↺ Reset', 'Speed: 1×']);
    fireEvent.click(within(controls()).getByRole('button', { name: '↺ Reset' }));
    expect(names()).toEqual(['▶ Start Live Surveillance', '↺ Reset', 'Speed: 1×']);
  });

  it('the controls are not shown in Scenario Replay, and Replay is unchanged', async () => {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, 'replay');
    renderAt('/dashboard');
    await screen.findByTestId('dashboard-replay', undefined, WAIT);
    expect(screen.queryByRole('group', { name: 'Live simulation controls' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Speed: / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next replay day' })).toBeTruthy();
    expect([1, 2, 3, 4, 5].map((day) => getScoreForDay(day as 1 | 2 | 3 | 4 | 5).composite)).toEqual([0, 24, 50, 74, 87]);
  });
});

describe('SPEED SELECTOR', () => {
  it('shows the current speed, opens 1× / 2× / 4×, and closes on a choice with focus back on it', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    // Closed: one compact button, no separate speed buttons anywhere.
    expect(speedButton().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('button', { name: SPEED_NAME })).toEqual([]);
    fireEvent.click(speedButton());
    expect(speedButton().getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('group', { name: 'Playback speed' });
    expect(speedButton().getAttribute('aria-controls')).toBe(list.id);
    const options = within(list).getAllByRole('button');
    expect(options.map((b) => b.textContent?.replace('✓', ''))).toEqual(['1×', '2×', '4×']);
    expect(options.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(document.activeElement).toBe(options[0]); // focus moves to the selected speed
    fireEvent.click(options[2]);
    expect(screen.queryByRole('group', { name: 'Playback speed' })).toBeNull();
    expect(speedButton().textContent).toBe('Speed: 4×');
    expect(document.activeElement).toBe(speedButton());
    // The new speed is announced.
    const announcement = Array.from(controls().querySelectorAll('[aria-live="polite"]')).map((el) => el.textContent);
    expect(announcement).toContain('Playback speed 4×');
    // Reopened, 4× is the pressed one; still exactly three speed buttons.
    fireEvent.click(speedButton());
    expect(screen.getAllByRole('button', { name: SPEED_NAME }).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
  });

  it('is keyboard operable: ArrowDown opens it, arrows move, Escape closes and returns focus', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    fireEvent.keyDown(speedButton(), { key: 'ArrowDown' });
    const list = screen.getByRole('group', { name: 'Playback speed' });
    const options = within(list).getAllByRole('button');
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(list, { key: 'End' });
    expect(document.activeElement).toBe(options[2]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(list, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Playback speed' })).toBeNull();
    expect(document.activeElement).toBe(speedButton());
    expect(speedButton().textContent).toBe('Speed: 1×'); // Escape changes nothing
  });

  it('the chosen speed drives playback exactly as before (4 steps per tick at 4×)', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    fireEvent.click(speedButton());
    fireEvent.click(screen.getByRole('button', { name: '4×' }));
    fireEvent.click(within(controls()).getByRole('button', { name: 'Start Live Surveillance' }));
    const clock = () => screen.getAllByTestId('live-clock')[0].textContent ?? '';
    const before = clock();
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 2); // 2 ticks × 4 × 15 min = 2 simulated hours
    });
    const minutes = (text: string) => {
      const [, h, m] = text.match(/(\d{2}):(\d{2})/) ?? [];
      return Number(h) * 60 + Number(m);
    };
    expect(minutes(clock()) - minutes(before)).toBe(120);
  });
});

describe('ACCORDIONS: Source activity, Today so far, Activity stream', () => {
  it('three collapsed cards with a title, a true one-line summary and a chevron; each expands', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    const live = screen.getByTestId('dashboard-live');
    const cards = ['live-sources', 'live-today', 'live-activity'].map((id) => within(live).getByTestId(id) as HTMLDetailsElement);
    for (const card of cards) {
      expect(card.tagName).toBe('DETAILS');
      expect(card.open).toBe(false);
      expect(card.querySelector('summary svg[aria-hidden="true"]')).toBeTruthy();
    }
    expect(screen.getByTestId('live-sources-summary').textContent).toBe('3 / 3 sources ready');
    expect(screen.getByTestId('live-today-summary').textContent).toMatch(/^Feb \d+ · No results yet$/);
    expect(screen.getByTestId('live-activity-summary').textContent).toBe('No activity yet');
    // The summary is part of each card's accessible name.
    expect(cards[0].querySelector('summary')?.textContent).toBe('Source activity3 / 3 sources ready');
    // Each expands in place; the content is the same panels as before.
    for (const card of cards) {
      fireEvent.click(card.querySelector('summary') as HTMLElement);
      expect(card.open).toBe(true);
    }
    expect(within(cards[0]).getByTestId('source-status').textContent).toContain('Sources · not started');
    expect(within(cards[1]).getByTestId('today-so-far')).toBeTruthy();
    expect(within(cards[2]).getByTestId('activity-stream').textContent).toContain('No activity yet. Start the live simulation');
  });

  it('the summaries follow the live state, from the existing data only', async () => {
    renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    vi.useFakeTimers();
    fireEvent.click(within(controls()).getByRole('button', { name: 'Start Live Surveillance' }));
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 40);
    });
    fireEvent.click(within(controls()).getByRole('button', { name: '❚❚ Pause' }));
    expect(screen.getByTestId('live-sources-summary').textContent).toMatch(/^Paused · \d \/ 3 active/);
    expect(screen.getByTestId('live-today-summary').textContent).toMatch(/^Feb \d+ · ([\d,]+ results? so far|No results yet)$/);
    const latest = screen.getByTestId('live-activity-summary').textContent ?? '';
    expect(latest).toMatch(/^Latest: /);
    // The newest activity entry, as the stream itself shows it (newest first).
    const first = screen.getByTestId('activity-stream').querySelector('ol > li p:nth-of-type(2)')?.textContent;
    expect(latest.endsWith(first ?? '∅')).toBe(true);
    // The stream keeps its 40-row cap.
    act(() => {
      fireEvent.click(within(controls()).getByRole('button', { name: '▶ Resume' }));
      vi.advanceTimersByTime(TICK_MS * 200);
    });
    expect(screen.getByTestId('activity-stream').querySelectorAll('ol > li').length).toBe(40);
  });
});

describe('TEST TOOLS: under System → Integration Demo', () => {
  it('absent from the Dashboard; present on Integration Demo, reachable from System, keyboard operable', async () => {
    const view = renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    expect(screen.queryByTestId('inject')).toBeNull();
    expect(screen.queryByText(/Test tools/)).toBeNull();
    view.unmount();
    renderAt('/integration-demo');
    await screen.findByRole('heading', { level: 1, name: 'Integration Demo' }, WAIT);
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0];
    const system = within(within(nav).getByRole('group', { name: 'System' })).getByRole('button', { name: /System/ });
    if (system.getAttribute('aria-expanded') !== 'true') fireEvent.click(system);
    expect(within(nav).getByRole('link', { name: /Integration Demo/ }).getAttribute('href')).toBe('/integration-demo');
    const tools = screen.getByTestId('inject');
    expect(within(tools).getByRole('heading', { name: 'Test tools: inject a synthetic test observation' })).toBeTruthy();
    expect(within(tools).getByLabelText('Facility').tagName).toBe('SELECT');
    expect(within(tools).getByLabelText('Test').tagName).toBe('SELECT');
    expect(within(tools).getByRole('group', { name: 'Result' })).toBeTruthy();
    expect(within(tools).getByRole('button', { name: 'Send test observation' })).toBeTruthy();
  });
});

describe('HOW THIS WORKS: under System → Architecture', () => {
  it('absent from the Dashboard; once on Architecture, with the pipeline and the reference-history note', async () => {
    const view = renderAt('/dashboard');
    await screen.findByRole('button', { name: 'Start Live Surveillance' }, WAIT);
    expect(screen.queryByText('How this works')).toBeNull();
    expect(screen.queryByTestId('live-statistics')).toBeNull();
    view.unmount();
    renderAt('/architecture');
    await screen.findByRole('heading', { level: 1, name: 'Signal by ProbeSyQ Architecture' }, WAIT);
    expect(screen.getByRole('heading', { name: 'How Live Surveillance works' })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'From observation to signal' })).getAllByRole('listitem').map((li) => li.textContent?.replace('→', '').trim())).toEqual([
      'Observation', 'Normalization', 'Profile routing', 'Surveillance calculation', 'Signal update',
    ]);
    expect(screen.getByTestId('live-statistics').textContent).toMatch(/EWMA, CUSUM\) needs a 28-day reference history/);
  });
});

describe('ROELLA: the new locations', () => {
  const ask = (q: string) => {
    const a = answerQuestion(q, { day: 5, route: 'dashboard' }, {}).answer;
    return { intent: a.intent, text: answerText(a) };
  };

  it('test tools → System → Integration Demo; processing → System → Architecture; speed → the header controls', () => {
    for (const q of ['Where are the test tools?', 'How do I inject a test observation?', 'Where can I send a synthetic test observation?']) {
      expect(ask(q).intent, q).toBe('live_test_tools');
      expect(ask(q).text, q).toContain('System → Integration Demo');
    }
    for (const q of ['How does Signal process observations?', 'How does Live Surveillance work?', 'Where is How this works?']) {
      expect(ask(q).intent, q).toBe('live_pipeline');
      expect(ask(q).text, q).toContain('Observation → Normalization → Profile routing → Surveillance calculation → Signal update');
      expect(ask(q).text, q).toContain('System → Architecture');
    }
    expect(ask('How do I change the speed?').text).toContain('Speed selector');
    // "latest observation" is not a test observation.
    expect(ask('Which source sent the latest observation?').intent).not.toBe('live_test_tools');
    // No answer points to the old sidebar mode switch.
    for (const q of ['What is the main mode?', 'What is Scenario Replay?', 'How do I start Live Surveillance?']) {
      expect(ask(q).text, q).not.toMatch(/sidebar’s mode switch|in the sidebar to open it/);
    }
  });
});
