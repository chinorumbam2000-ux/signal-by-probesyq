// @vitest-environment jsdom
/**
 * Scenario Replay keeps one home for each thing: the top bar has the replay
 * day and date with Previous / Next / Reset; the page has the five-day
 * timeline (jump to any day), one stateful Auto Play control, the day's
 * story, Current State (the one detailed score), only what changed since
 * the previous day, and a concise progression table.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
import { getScenario } from '../../data/simulation';
import { formatSimulationDate } from '../../lib/format';
import { getScoreForDay } from '../../lib/selectors';
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
const main = () => document.querySelector('main') as HTMLElement;
const topBar = () => screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
const replayDay = () => within(topBar()).getByTestId('replay-day').textContent ?? '';
async function replayAt(day: 1 | 2 | 3 | 4 | 5) {
  chooseScenarioReplayForTest();
  saveSession({ day, acknowledgements: {}, investigations: {}, reports: [] });
  render(
    <MemoryRouter initialEntries={['/replay']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Scenario Replay' }, WAIT);
}

describe('day controls', () => {
  it('the page has no Previous / Advance / Reset buttons; the top bar keeps them', async () => {
    await replayAt(3);
    for (const name of [/Previous Day/, /Advance Day/, /Reset Replay/]) {
      expect(within(main()).queryByRole('button', { name })).toBeNull();
    }
    expect(within(topBar()).getByRole('button', { name: 'Previous replay day' })).toBeTruthy();
    expect(within(topBar()).getByRole('button', { name: 'Next replay day' })).toBeTruthy();
    expect(within(topBar()).getByRole('button', { name: 'Reset Scenario Replay to Day 1' })).toBeTruthy();
    // No two controls do the same thing: one way to step, one to reset, the timeline to jump.
    expect(screen.getAllByRole('button', { name: /Reset/ })).toHaveLength(1);
  });

  it('the five-day timeline names each day, marks the selected one and jumps to any day', async () => {
    await replayAt(5);
    const timeline = screen.getByRole('list', { name: 'Five-day timeline' });
    const days = within(timeline).getAllByRole('button');
    // The visible text is the accessible name (label in name); the selected day is aria-current.
    const name = (day: 1 | 2 | 3 | 4 | 5) => `Day ${day}, ${getScenario(day).stage}, Score ${getScoreForDay(day).composite} · ${getScoreForDay(day).severity}`;
    for (const day of [1, 2, 3, 4, 5] as const) {
      expect(within(timeline).getByRole('button', { name: (n) => n.replace(/\s+,/g, ',') === name(day) })).toBe(days[day - 1]);
    }
    expect(days[4].getAttribute('aria-current')).toBe('step');
    fireEvent.click(days[2]);
    expect(replayDay()).toMatch(/^Day 3 of 5/);
    expect(within(timeline).getAllByRole('button')[2].getAttribute('aria-current')).toBe('step');
    // Days not reached yet say so, in words.
    expect(within(timeline).getByRole('button', { name: (n) => n.replace(/\s+,/g, ',') === `Day 5, ${getScenario(5).stage}, Not yet reached` })).toBeTruthy();
    // Top bar steps and Reset still work.
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Next replay day' }));
    expect(replayDay()).toMatch(/^Day 4 of 5/);
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Previous replay day' }));
    expect(replayDay()).toMatch(/^Day 3 of 5/);
    fireEvent.click(within(topBar()).getByRole('button', { name: 'Reset Scenario Replay to Day 1' }));
    expect(replayDay()).toMatch(/^Day 1 of 5/);
  });

  it('Auto Play is one stateful control: Auto Play, then Pause Auto Play while playing', async () => {
    await replayAt(1);
    const control = () => screen.getByTestId('replay-autoplay');
    expect(control().textContent).toBe('▶ Auto Play');
    expect(control().getAttribute('aria-pressed')).toBe('false');
    // No Pause control while nothing is playing.
    expect(within(main()).queryByRole('button', { name: /Pause/ })).toBeNull();
    vi.useFakeTimers();
    fireEvent.click(control());
    expect(control().textContent).toBe('❚❚ Pause Auto Play');
    expect(control().getAttribute('aria-pressed')).toBe('true');
    expect(within(main()).queryByRole('button', { name: '▶ Auto Play' })).toBeNull();
    expect(screen.getByTestId('replay-autoplay-status').textContent).toMatch(/^Auto-playing/);
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(replayDay()).toMatch(/^Day 2 of 5/);
    fireEvent.click(control());
    expect(control().textContent).toBe('▶ Auto Play');
    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(replayDay()).toMatch(/^Day 2 of 5/);
  });
});

describe('the day\'s story and the score', () => {
  it('the story card has the day and stage, with no score or date of its own', async () => {
    await replayAt(5);
    const story = screen.getByTestId('replay-story');
    const heading = within(story).getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe(`Day 5 of 5${getScenario(5).stage}`);
    expect(story.textContent).not.toMatch(/Composite Signal Score|\/ 100/);
    expect(story.textContent).not.toContain(formatSimulationDate(getScenario(5).simulationDate));
  });

  it('one main current score (Current State); the timeline and the table show the progression', async () => {
    await replayAt(5);
    const labels = [...main().querySelectorAll('.ls-label')].filter((e) => /Signal Score/.test(e.textContent ?? ''));
    expect(labels).toHaveLength(1);
    const state = screen.getByTestId('replay-current-state');
    expect(state.textContent).toContain('87 / 100');
    expect(within(state).getByText('Critical')).toBeTruthy();
    expect(main().textContent?.match(/87 \/ 100/g)).toHaveLength(1);
    const table = screen.getByRole('table', { name: /five-day progression/ });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Day', 'Stage', 'Tests', 'Positivity', 'Facilities · Areas', 'Score',
    ]);
    const rows = within(table).getAllByTestId('progression-row');
    expect(rows).toHaveLength(5);
    expect(rows[4].getAttribute('aria-current')).toBe('step');
    expect(rows.map((row) => row.querySelector('td:last-child .tabular-nums')?.textContent)).toEqual(['0', '24', '50', '74', '87']);
  });

  it('the date is the top bar\'s alone; no sidebar date; one introduction', async () => {
    await replayAt(5);
    const date = formatSimulationDate(getScenario(5).simulationDate);
    expect(topBar().textContent).toContain(date);
    expect(topBar().textContent).toContain('Day 5 of 5');
    expect(main().textContent).not.toContain(date);
    expect(main().textContent).not.toMatch(/Replay date|Replay Day 5 of 5/);
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0];
    expect(nav.textContent).not.toMatch(/Replay Day|Replay date|Nov \d/);
    expect(screen.getByTestId('replay-subtitle').textContent).toBe('Historical training scenario');
    const header = screen.getByRole('heading', { level: 1, name: 'Scenario Replay' }).closest('header') as HTMLElement;
    expect(header.querySelectorAll('p')).toHaveLength(2);
    expect(main().textContent?.match(/Live Surveillance is the operational mode/g)).toHaveLength(1);
    expect(main().textContent).not.toMatch(/The narrated scenario is|Its replay dates are its own/);
  });

  it('Change since the previous day lists only what moved, then why the score moved', async () => {
    await replayAt(5);
    const change = screen.getByTestId('day-change');
    expect(within(change).getByRole('heading', { level: 2 }).textContent).toBe('Change since Day 4');
    expect(change.textContent).toContain('Score +13');
    expect(within(change).queryByRole('table')).toBeNull();
    const items = within(screen.getByTestId('day-change-metrics')).getAllByRole('listitem');
    for (const item of items) {
      expect(item.textContent).not.toMatch(/Composite Outbreak Signal Score|No change/);
      expect(item.textContent).toMatch(/(Up|Down): /);
    }
    expect(within(change).getByText('Why the score moved')).toBeTruthy();
  });

  it('Day 1 has no previous day to compare', async () => {
    await replayAt(1);
    expect(screen.getByText('Baseline — no previous surveillance day available.')).toBeTruthy();
    expect(screen.getByTestId('replay-autoplay').textContent).toBe('▶ Auto Play');
  });
});
