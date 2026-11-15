// @vitest-environment jsdom
/**
 * Transparent without repeating itself: one clear simulated-data disclosure per
 * area, the full explanation in About this data, technical detail on System
 * pages, one current name for everything, and the ownership notice where it
 * belongs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
import { COPYRIGHT_NOTICE, TRADEMARK_NOTICE } from '../../lib/brand';
import { EVALUATION_LABEL } from '../../lib/evaluation';
import { ANALYST_SECTIONS } from '../../lib/navigation';
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
const main = () => document.querySelector('main') as HTMLElement;
const topBar = () => screen.getAllByRole('banner').find((el) => el.tagName === 'HEADER') as HTMLElement;
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
async function replayAt(path: string) {
  chooseScenarioReplayForTest();
  saveSession({ day: 5, acknowledgements: {}, investigations: {}, reports: [] });
  renderAt(path);
  await screen.findByRole('heading', { level: 1 }, WAIT);
}
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

describe('one simulated-data disclosure per area', () => {
  it('Live Surveillance: the top bar once, the page once, no card repeating it', async () => {
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    expect(count(topBar().textContent ?? '', /simulated/gi)).toBe(1);
    expect(screen.getByTestId('live-subtitle').textContent).toBe('Current simulated feed');
    // The subtitle is the page's disclosure; the synthetic test observation names itself.
    expect(count(main().textContent ?? '', /simulated/gi)).toBe(1);
    expect(screen.getByTestId('source-status').textContent).not.toMatch(/simulated/i);
    expect(screen.getByTestId('source-status').textContent).toMatch(/FHIR R4/);
  });

  it('Dashboard: one privacy explanation and no restated "synthetic" in the trend', async () => {
    await replayAt('/dashboard');
    expect(screen.getAllByText('About this privacy rule')).toHaveLength(1);
    expect(screen.getByText('Day 1 to Day 5 · aggregate data')).toBeTruthy();
    expect(screen.getByTestId('start-here').textContent).toMatch(/Everything is synthetic/);
  });

  it('the page header names the period; the date and clock are the top bar\'s', async () => {
    await replayAt('/signals');
    expect(screen.getByTestId('page-meta').textContent).toBe('Replay Day 5 of 5 · Regional Early-Warning Signal');
    expect(document.body.textContent).not.toMatch(/Replay date:|Live surveillance date:/);
    expect(within(topBar()).getByTestId('replay-day').textContent).toMatch(/Day 5 of 5\s*Fri, Nov 7, 2025/);
  });

  it('the investigation\'s feed card says once that its telemetry is simulated', async () => {
    await replayAt('/investigations?alert=ALERT-REGIONAL-D4');
    await screen.findByTestId('signal-investigation', {}, WAIT);
    expect(main().textContent).not.toContain('Simulated EHR environment');
    expect(count(main().textContent ?? '', /Simulated feed telemetry/g)).toBe(1);
    expect(count(main().textContent ?? '', /not a confirmed outbreak/g)).toBe(1);
  });
});

describe('About this data is the authoritative home', () => {
  it('states every limitation in one place', async () => {
    renderAt('/overview');
    const about = (await screen.findByRole('heading', { name: 'About this data' }, WAIT)).closest('section') as HTMLElement;
    const text = about.textContent ?? '';
    for (const re of [
      /Synthetic data only\. No real patient data\./,
      /No production Epic, Oracle Health or MEDITECH connection: the vendor environments and source feeds are simulated/,
      /No real hospital, laboratory, EHR vendor or patient is connected/,
      /illustrative default, not epidemiologically validated/,
      /not validated for public-health decisions/,
      /early-warning signal for epidemiological review, not confirmation of an outbreak/,
      /Positive counts below 5/,
      /Data Confidence describes/,
      /EWMA and CUSUM need a 28-day reference period/,
      /Before any production use/,
    ]) {
      expect(text, String(re)).toMatch(re);
    }
    expect(text).toContain(`${TRADEMARK_NOTICE} ${COPYRIGHT_NOTICE}`);
  });

  it('Validation links to it instead of repeating its disclaimer', async () => {
    expect(EVALUATION_LABEL).toBe('Experimental evaluation using synthetic scenarios.');
  });
});

describe('Live: "How this works" is short and points to System', () => {
  it('one collapsed disclosure with the pipeline, the reference-history line and the Detection Methods link', async () => {
    renderAt('/live');
    await screen.findByRole('heading', { level: 1, name: 'Live Surveillance' }, WAIT);
    const how = screen.getByTestId('live-how-it-works') as HTMLDetailsElement;
    expect(how.tagName).toBe('DETAILS');
    expect(how.open).toBe(false);
    expect(within(how).getByText('How this works')).toBeTruthy();
    expect(within(within(how).getByRole('list', { name: 'From observation to signal' })).getAllByRole('listitem').map((li) => li.textContent?.replace('→', '').trim())).toEqual([
      'Observation', 'Normalization', 'Profile routing', 'Surveillance calculation', 'Signal update',
    ]);
    expect(screen.getByTestId('live-statistics').textContent).toMatch(/needs a 28-day reference history; this feed holds 7 days, so none is shown or invented/);
    expect(within(how).getByRole('link', { name: 'View Detection Methods' }).getAttribute('href')).toBe('/dynamic-surveillance');
    expect(screen.queryByRole('heading', { name: 'How an observation becomes a signal' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Statistical confirmation/ })).toBeNull();
  });
});

describe('System pages each have one purpose', () => {
  it('Project Overview introduces every page by its sidebar name, without a misleading mode chip', async () => {
    renderAt('/overview');
    const explore = (await screen.findByRole('heading', { name: 'Explore' }, WAIT)).closest('section') as HTMLElement;
    expect(explore.textContent).not.toMatch(/Current mode/i);
    const titles = within(explore).getAllByRole('link').map((a) => a.querySelector('.text-base')?.textContent?.replace(' →', ''));
    expect(titles).toEqual([
      'Live Surveillance', 'Scenario Replay', 'Data Ingestion', 'Detection Methods', 'Integration Testing', 'Integration Demo', 'Validation', 'Architecture',
    ]);
    expect(within(explore).getAllByText('Analyst page')).toHaveLength(2);
    expect(within(explore).getAllByText('System page')).toHaveLength(6);
  });

  it('Integration Demo points to the SMART sandbox rather than repeating it', async () => {
    await replayAt('/integration-demo');
    expect(main().textContent).toMatch(/standards-based SMART launch against a public sandbox is separate\s+\(System → Integration Testing, when enabled\)/);
    // Not Live's feed operations or Facilities' data quality (the sidecar's own reading is its content).
    expect(main().textContent).not.toMatch(/Facility Feed Health|Last observation|Data quality|messages/);
  });
});

describe('terminology', () => {
  it.each(['/dashboard', '/live', '/replay', '/signals', '/facilities', '/laboratory-data', '/analytics', '/investigations', '/reports', '/integration-demo', '/overview', '/architecture'])(
    '%s uses the current names only',
    async (path) => {
      await replayAt(path);
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/LabSentinel|Classroom|Respiratory Viral Syndrome|Simulation Day|Composite Signal Score|capstone|Hospitals page|Affected Hospitals/i);
      expect(text).not.toContain('®');
    },
  );

  it('another profile\'s investigation names Respiratory Viral Activity, not its former name', async () => {
    await replayAt('/investigations?profile=covid-19&alert=ALERT-COVID-19-REGIONAL-D5');
    expect((await screen.findByTestId('evidence-unavailable', {}, WAIT)).textContent).toContain('covers Respiratory Viral Activity in this release');
  });

  it('the sidebar uses the final page names', () => {
    const labels = ANALYST_SECTIONS.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual(expect.arrayContaining(['Dashboard', 'Live Surveillance', 'Scenario Replay', 'Outbreak Map', 'Signals', 'Facilities', 'Laboratory Data', 'Analytics', 'Investigations', 'Reports']));
  });
});

describe('ownership', () => {
  it('the notice is unchanged, ™ only, and kept to its approved places', async () => {
    expect(TRADEMARK_NOTICE).toBe('ProbeSyQ™ and Signal by ProbeSyQ™ are trademarks claimed by their owner.');
    expect(COPYRIGHT_NOTICE).toBe('© 2026 Munyaradzi Chinorumba. All rights reserved.');
    for (const path of ['/dashboard', '/live', '/signals', '/facilities']) {
      await replayAt(path);
      expect(document.body.textContent, path).not.toContain('All rights reserved');
      cleanup();
    }
  });
});
