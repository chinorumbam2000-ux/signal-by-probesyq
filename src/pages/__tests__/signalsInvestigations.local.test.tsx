// @vitest-environment jsdom
/**
 * Signals is the alert queue; Investigations holds the alerts that have
 * entered review. "Investigate" on Signals starts an alert's review (with its
 * acknowledgement, once) and continues on Investigations, which owns the
 * evidence, the review actions and the report. Old /signals?alert= links are
 * forwarded there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
import { getProfileAlerts } from '../../lib/profiles/portfolio';
import { getDataConfidence } from '../../lib/dataConfidence';
import { answerQuestion, answerText } from '../../assistant/answerEngine';
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
let path = '';
let search = '';
let navigateTo: NavigateFunction = () => {};
function Probe() {
  const location = useLocation();
  path = location.pathname;
  search = location.search;
  navigateTo = useNavigate();
  return null;
}
const renderAt = (...entries: string[]) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <App />
      <Probe />
    </MemoryRouter>,
  );
const main = () => document.querySelector('main') as HTMLElement;
async function replayAt(...entries: string[]) {
  chooseScenarioReplayForTest();
  saveSession({ day: 5, acknowledgements: {}, investigations: {}, reports: [] });
  renderAt(...entries);
  await screen.findByRole('heading', { level: 1 }, WAIT);
}
const bellCount = () => screen.getByRole('button', { name: /^Notifications:/ }).getAttribute('aria-label');
const rowOf = (text: RegExp) =>
  screen.getAllByTestId('alert-row').find((row) => text.test(row.textContent ?? '')) as HTMLElement;
const REGIONAL = 'ALERT-REGIONAL-D4';

describe('Signals: the alert queue', () => {
  it('keeps every new alert, each with Acknowledge and Investigate, and no workflow controls', async () => {
    await replayAt('/signals?profile=all');
    const total = getProfileAlerts(5).length;
    expect(screen.getAllByTestId('alert-row')).toHaveLength(total);
    for (const status of screen.getAllByTestId('review-status')) expect(status.textContent).toBe('Not started');
    expect(screen.getAllByRole('button', { name: /^Acknowledge alert:/ })).toHaveLength(total);
    expect(screen.getAllByRole('button', { name: /^Investigate alert:/ })).toHaveLength(total);
    expect(main().textContent).not.toMatch(/Begin Review|Escalate|Dismiss|Prepare Public Health Report|Why this signal/);
    // Acknowledging stays on Signals and leaves the alert in the queue.
    fireEvent.click(screen.getAllByRole('button', { name: /^Acknowledge alert: COVID-19 — Regional/ })[0]);
    expect(bellCount()).toContain(`${total - 1} alerts`);
    expect(screen.getAllByTestId('alert-row')).toHaveLength(total);
  });

  it('Investigate acknowledges once, starts the review and moves to the investigation on Investigations', async () => {
    await replayAt('/signals');
    fireEvent.click(screen.getByRole('button', { name: /^Investigate alert: Regional outbreak signal detected/ }));
    await screen.findByTestId('signal-investigation', {}, WAIT);
    expect(path).toBe('/investigations');
    expect(search).toBe(`?profile=respiratory-viral-syndrome&alert=${REGIONAL}`);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Respiratory Viral Activity — Regional outbreak signal detected');
    const review = screen.getByRole('region', { name: 'Investigation review' });
    expect(within(review).getByText('UNDER REVIEW')).toBeTruthy();
    expect(review.textContent?.match(/Analyst acknowledged/g)).toHaveLength(1);
    expect(review.textContent).toContain('Review started');
    // Already acknowledged: the review never asks again.
    expect(within(review).queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    for (const action of ['Continue Monitoring', 'Escalate', 'Dismiss', 'Close']) {
      expect(within(review).getByRole('button', { name: new RegExp(`^${action}`) })).toBeTruthy();
    }
    expect(within(review).getByRole('button', { name: 'Prepare Public Health Report' })).toBeTruthy();
    expect(bellCount()).toContain('14 alerts');

    // Back on Signals the alert shows its review state and opens its investigation.
    navigateTo('/signals');
    await screen.findByRole('heading', { level: 1, name: 'Signals & Alerts' }, WAIT);
    const row = rowOf(/Regional outbreak signal detected/);
    expect(within(row).getByTestId('review-status').textContent).toBe('Under review');
    expect(within(row).queryByRole('button', { name: /^Investigate/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /^Acknowledge/ })).toBeNull();
    expect(within(row).getByRole('link', { name: /^Open investigation: Regional outbreak signal detected/ }).getAttribute('href')).toBe(
      `/investigations?profile=respiratory-viral-syndrome&alert=${REGIONAL}`,
    );
  });

  it('an alert acknowledged on Signals is not acknowledged again when its review starts', async () => {
    await replayAt('/signals');
    fireEvent.click(screen.getByRole('button', { name: /^Acknowledge alert: Regional outbreak signal detected/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Investigate alert: Regional outbreak signal detected/ }));
    const review = await screen.findByRole('region', { name: 'Investigation review' }, WAIT);
    expect(review.textContent).not.toContain('Analyst acknowledged');
    expect(within(review).queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(bellCount()).toContain('14 alerts');
  });
});

describe('Investigations: the alerts under review', () => {
  it('lists only alerts whose review has started, with their status in words', async () => {
    await replayAt('/signals?profile=all');
    fireEvent.click(screen.getByRole('button', { name: /^Investigate alert: COVID-19 — Regional/ }));
    const review = await screen.findByRole('region', { name: 'Investigation review' }, WAIT);
    // Escalate needs a note.
    fireEvent.click(within(review).getByRole('button', { name: /^Escalate/ }));
    fireEvent.change(within(review).getByRole('textbox'), { target: { value: 'Refer to the regional team.' } });
    fireEvent.click(within(review).getAllByRole('button', { name: /^Escalate/ })[0]);
    expect(within(review).getByText('ESCALATED')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '← Back to investigations' }));
    const table = await screen.findByRole('table', { name: /under review/ }, WAIT);
    const rows = within(table).getAllByTestId('investigation-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('COVID-19');
    expect(within(rows[0]).getByText('Escalated')).toBeTruthy();
    expect(within(rows[0]).getByText('Public Health Analyst')).toBeTruthy();
    expect(within(rows[0]).getByText('Not prepared')).toBeTruthy();
    expect(screen.getByText(`${getProfileAlerts(5).length - 1} alerts have not started review yet: they are in the Signals queue.`)).toBeTruthy();
    // A short hint, not a step-by-step tutorial.
    expect(screen.queryByRole('list', { name: 'Investigation workflow' })).toBeNull();
    expect(main().textContent).not.toMatch(/Step \d/);
  });
});

describe('routes', () => {
  it('forwards an old /signals?alert= link to the investigation, keeping every parameter', async () => {
    await replayAt(`/signals?profile=respiratory-viral-syndrome&alert=${REGIONAL}&view=detection`);
    await screen.findByTestId('signal-investigation', {}, WAIT);
    expect(path).toBe('/investigations');
    expect(search).toBe(`?profile=respiratory-viral-syndrome&alert=${REGIONAL}&view=detection`);
  });

  it('forwards /signals?view=current to current conditions on Investigations', async () => {
    await replayAt('/signals?view=current');
    await screen.findByTestId('signal-investigation', {}, WAIT);
    expect(path).toBe('/investigations');
    expect(screen.getByTestId('investigation-day').textContent).toMatch(/^Current conditions — Day 5/);
  });

  it('the forward replaces the old entry, so Back does not bounce', async () => {
    await replayAt('/dashboard', `/signals?alert=${REGIONAL}`);
    await screen.findByTestId('signal-investigation', {}, WAIT);
    navigateTo(-1);
    await screen.findByTestId('active-surveillance', {}, WAIT);
    expect(path).toBe('/dashboard');
  });

  it('/investigations?alert= opens the investigation; the view toggle keeps the alert and profile; Back returns', async () => {
    await replayAt('/investigations', `/investigations?profile=respiratory-viral-syndrome&alert=${REGIONAL}`);
    await screen.findByTestId('signal-investigation', {}, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Current conditions — Day 5' }));
    expect(search).toBe(`?profile=respiratory-viral-syndrome&alert=${REGIONAL}&view=current`);
    navigateTo(-1);
    await screen.findByTestId('signal-investigation', {}, WAIT);
    expect(search).toBe(`?profile=respiratory-viral-syndrome&alert=${REGIONAL}`);
    navigateTo(-1);
    expect(await screen.findByRole('heading', { level: 1, name: 'Investigations' }, WAIT)).toBeTruthy();
  });
});

describe('investigation detail', () => {
  it('one score breakdown, one Data Confidence, both labelled at detection', async () => {
    await replayAt(`/investigations?alert=${REGIONAL}`);
    const detail = await screen.findByTestId('signal-investigation', {}, WAIT);
    expect(screen.getAllByTestId('score-breakdown')).toHaveLength(1);
    expect(within(screen.getByTestId('score-breakdown')).getAllByRole('listitem')).toHaveLength(5);
    expect(detail.textContent).not.toMatch(/Show the weighted calculation|Interpretation/);
    expect([...detail.querySelectorAll('table caption')].filter((c) => /composite outbreak signal score/.test(c.textContent ?? ''))).toHaveLength(0);
    expect(within(detail).getByRole('heading', { name: /^Score at detection: how the 74 is made up/ })).toBeTruthy();
    expect(within(screen.getByTestId('investigation-identity')).getByText('Score at detection')).toBeTruthy();
    expect(screen.getByTestId('investigation-day').textContent).toMatch(/^At detection — Day 4/);
    // Data Confidence once, of the detection day — not today's.
    expect(within(detail).getAllByLabelText(/^Data confidence/)).toHaveLength(2); // the card and its score
    expect(detail.querySelectorAll('section[aria-label="Data confidence"]')).toHaveLength(1);
    const confidence = screen.getByTestId('investigation-confidence');
    expect(within(confidence).getByRole('heading', { name: /^Data Confidence at detection — Day 4/ })).toBeTruthy();
    expect(within(confidence).getByLabelText(/^Data confidence \d+ of 100/).getAttribute('aria-label')).toContain(
      `Data confidence ${getDataConfidence(4).score} of 100`,
    );
    // Why this signal: the interpretation, without its own score, calculation or Data Confidence strip.
    const why = screen.getByRole('region', { name: 'Why this signal' });
    expect(why.textContent).not.toMatch(/Data Confidence|Feed Health|\/100/);
  });

  it('another profile keeps its own evidence and names its profile and type', async () => {
    await replayAt('/investigations?profile=covid-19&alert=ALERT-COVID-19-REGIONAL-D5');
    const shell = await screen.findByTestId('profile-investigation', {}, WAIT);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('COVID-19 — Regional outbreak signal detected');
    expect(within(shell).getByText('Pathogen')).toBeTruthy();
    expect(within(shell).getByText('Composite score at detection')).toBeTruthy();
    expect(within(shell).getByText('93 / 100')).toBeTruthy();
  });
});

describe('reports', () => {
  it('a report is prepared from the investigation, and the empty Reports page points to Investigations', async () => {
    await replayAt('/reports');
    expect(screen.getByRole('link', { name: 'Go to Investigations' }).getAttribute('href')).toBe('/investigations');
    cleanup();
    renderAt('/signals');
    fireEvent.click(await screen.findByRole('button', { name: /^Investigate alert: Regional outbreak signal detected/ }, WAIT));
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare Public Health Report' }, WAIT));
    await screen.findByRole('heading', { level: 1, name: /Reports/ }, WAIT);
    expect(path).toBe('/reports');
    expect(search).toBe('?profile=respiratory-viral-syndrome');
    expect(main().textContent).toContain('Regional outbreak signal detected');
  });
});

describe('Roella', () => {
  const ask = (question: string) => answerText(answerQuestion(question, { day: 5, route: 'dashboard' }, {}).answer);
  it('tells Signals and Investigations apart', () => {
    expect(ask('What is Signals?')).toContain('the surveillance alert queue');
    expect(ask('What is Investigations?')).toContain('the signals that have entered active review');
    expect(ask('Where do I acknowledge an alert?')).toContain('Open Signals in the sidebar');
    expect(ask('Where do I review evidence?')).toContain('Open Investigations in the sidebar');
    expect(ask('What should I investigate next?')).toContain('Start the review of the regional signal from Signals (Investigate)');
  });
});

describe('Live Surveillance', () => {
  it('Signals acknowledges only; an investigation link shows the limitation, never replay evidence', async () => {
    renderAt(`/investigations?alert=${REGIONAL}`);
    expect(await screen.findByText('Investigations follow Scenario Replay', {}, WAIT)).toBeTruthy();
    expect(screen.queryByTestId('signal-investigation')).toBeNull();
    expect(main().textContent).not.toMatch(/Day 4|Score at detection|Data Confidence at detection/);
    cleanup();
    renderAt('/investigations');
    expect(await screen.findByTestId('live-mode-note', {}, WAIT)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    cleanup();
    renderAt('/signals');
    await screen.findByRole('heading', { level: 1, name: 'Signals & Alerts' }, WAIT);
    expect(screen.queryByRole('columnheader', { name: 'Review' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Investigate/ })).toBeNull();
  });
});
