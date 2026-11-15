// @vitest-environment jsdom
/**
 * Facilities is facility contribution and data quality: no record list (that
 * is Laboratory Data), no signal reasoning (Signals and Investigations), no
 * operational feed detail (Live Surveillance) and no EHR sidecar (System →
 * Integration Demo). The Data Confidence breakdown appears once, here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../../App';
import { saveSession } from '../../lib/sessionState';
import { getDataConfidence } from '../../lib/dataConfidence';
import { modeForPath } from '../../lib/appModes';
import { systemItems } from '../../lib/navigation';
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
function Probe() {
  const location = useLocation();
  path = location.pathname;
  search = location.search;
  return null;
}
const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <Probe />
    </MemoryRouter>,
  );
const main = () => document.querySelector('main') as HTMLElement;
async function replayAt(entry: string) {
  chooseScenarioReplayForTest();
  saveSession({ day: 5, acknowledgements: {}, investigations: {}, reports: [] });
  renderAt(entry);
  await screen.findByRole('heading', { level: 1 }, WAIT);
}

describe('Facilities: contribution and data quality', () => {
  it('has a concise table and no record list, signal reasoning, feed operations or sidecar', async () => {
    await replayAt('/facilities');
    const table = screen.getByRole('table', { name: /^Reporting status, contribution/ });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Facility', 'Reporting', 'Contribution', 'Positivity', 'Data quality', 'Show details',
    ]);
    expect(within(table).getAllByTestId('facility-row')).toHaveLength(3);
    for (const cell of within(table).getAllByTestId('facility-contribution')) {
      expect(cell.textContent).toMatch(/In the signal|Not in the signal/);
      expect(cell.textContent).toMatch(/\d+ tests · \d+% of the profile's$/);
    }
    for (const cell of within(table).getAllByTestId('facility-quality-summary')) {
      expect(cell.textContent).toMatch(/^\d+% complete · \d+% mapped$|^No data — quality unknown$/);
    }
    const text = main().textContent ?? '';
    // Records are on Laboratory Data; reasoning on Signals; feed operations on Live; the sidecar under System.
    expect(text).not.toMatch(/Recent Observations|Patient ID|FHIR Status/);
    expect(screen.queryByRole('region', { name: 'Why this signal' })).toBeNull();
    expect(text).not.toMatch(/Clinician sidecar|Vendor Environment|Integration details|VendorSidecar/);
    expect(text).not.toMatch(/FHIR R4|HL7 v2|LIS\/API|Latency|messages|events received|Last observation/);
    // The page's own date is the header's, not a card's.
    expect(text).not.toMatch(/Replay date ·|Live surveillance date ·/);
  });

  it('shows Data Confidence once, with its full breakdown, and the facility\'s own quality evidence', async () => {
    await replayAt('/facilities');
    const quality = screen.getByTestId('facilities-data-quality');
    expect(within(quality).getByRole('heading', { level: 2, name: 'Data quality' })).toBeTruthy();
    expect(main().querySelectorAll('section[aria-label="Data confidence"]')).toHaveLength(1);
    const confidence = within(quality).getByRole('region', { name: 'Data confidence' });
    // The formula is unchanged: the card shows the engine's own score.
    expect(within(confidence).getByRole('img').getAttribute('aria-label')).toBe(
      `Data confidence ${getDataConfidence(5).score} of 100, ${getDataConfidence(5).level}`,
    );
    const breakdown = confidence.querySelector('details') as HTMLDetailsElement;
    expect(breakdown.open).toBe(true);
    expect(within(breakdown).getAllByRole('row').length).toBeGreaterThan(5);
    expect(confidence.textContent).toContain('it never changes the Composite Outbreak Signal');
    const facility = screen.getByTestId('facility-data-quality');
    expect(within(facility).getByText('Worcester Central Medical Center: data quality')).toBeTruthy();
    for (const label of ['Freshness', 'Completeness', 'Terminology mapping', 'Integrity']) {
      expect(within(facility).getByText(label)).toBeTruthy();
    }
    // The freshness timestamp appears once on the screen.
    expect(main().textContent?.match(/Last event/g)).toHaveLength(1);
    // Choosing another facility moves the detail and the quality evidence together.
    fireEvent.click(screen.getByRole('button', { name: 'Details for Shrewsbury Community Medical Center' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Shrewsbury Community Medical Center' })).toBeTruthy();
    expect(within(screen.getByTestId('facility-data-quality')).getByText('Shrewsbury Community Medical Center: data quality')).toBeTruthy();
  });

  it('links to the facility\'s laboratory records, keeping the profile and the facility', async () => {
    await replayAt('/facilities?profile=covid-19');
    fireEvent.click(screen.getByRole('button', { name: 'Details for Central Massachusetts Regional Hospital' }));
    const link = screen.getByRole('link', { name: "View this facility's laboratory records" });
    expect(link.getAttribute('href')).toBe('/laboratory-data?profile=covid-19&facility=HOSP-B');
    expect(screen.getByRole('link', { name: 'Review signal evidence' }).getAttribute('href')).toBe('/signals?profile=covid-19');
    fireEvent.click(link);
    await screen.findByLabelText('Facility', {}, WAIT);
    expect(path).toBe('/laboratory-data');
    expect(search).toBe('?profile=covid-19&facility=HOSP-B');
    expect((screen.getByLabelText('Facility') as HTMLSelectElement).value).toBe('HOSP-B');
    expect((screen.getByLabelText('Surveillance profile') as HTMLSelectElement).value).toBe('covid-19');
  });

  it('follows the selected profile', async () => {
    await replayAt('/facilities?profile=covid-19');
    const covid = within(screen.getByRole('table', { name: /^Reporting status, contribution/ })).getAllByTestId('facility-contribution').map((c) => c.textContent);
    cleanup();
    renderAt('/facilities?profile=respiratory-viral-syndrome');
    await screen.findByRole('heading', { level: 1, name: 'Facilities' }, WAIT);
    const rvs = within(screen.getByRole('table', { name: /^Reporting status, contribution/ })).getAllByTestId('facility-contribution').map((c) => c.textContent);
    expect(covid).not.toEqual(rvs);
    expect(screen.getByRole('table', { name: /^Reporting status, contribution/ }).querySelector('caption')?.textContent).toContain('Respiratory Viral Activity');
  });

  it('the Dashboard\'s "View facility data quality" lands on the Data quality section of Facilities', async () => {
    await replayAt('/dashboard?profile=covid-19');
    fireEvent.click(screen.getByTestId('facility-quality-link'));
    await screen.findByTestId('facilities-data-quality', {}, WAIT);
    expect(path).toBe('/facilities');
    expect(search).toBe('?profile=covid-19');
  });
});

describe('the EHR sidecar: System → Integration Demo', () => {
  it('is listed under System in every build and shows the sidecar in Scenario Replay', async () => {
    expect(systemItems('local', false).map((item) => item.to)).toContain('/integration-demo');
    expect(modeForPath('/integration-demo')).toBe('integration');
    expect(modeForPath('/smart/sidecar')).toBe('smart');
    await replayAt('/integration-demo');
    expect(screen.getByRole('heading', { level: 1, name: 'Integration Demo' })).toBeTruthy();
    expect(main().textContent).toMatch(/not a connection to, or a partnership with, Epic,\s+Oracle Health or MEDITECH/);
    expect(screen.getByLabelText('Signal by ProbeSyQ regional respiratory activity')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.querySelector('span')?.textContent)).toEqual(['Epic', 'Oracle Health', 'MEDITECH']);
    fireEvent.click(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByText('Simulated MEDITECH Environment').length).toBeGreaterThan(0);
    expect(screen.getByText('Integration details')).toBeTruthy();
    // System page: the mode is named, the full simulated-data banner is shown.
    expect(screen.getByText('Simulated surveillance data.')).toBeTruthy();
  });
});

describe('Live Surveillance keeps the feed operations', () => {
  it('shows each source\'s type and last observation; Facilities does not', async () => {
    renderAt('/live');
    const sources = await screen.findByTestId('source-status', {}, WAIT);
    expect(sources.textContent).toMatch(/FHIR R4/);
    expect(sources.textContent).toMatch(/HL7 v2/);
    expect(sources.textContent).toMatch(/Last observation/);
    cleanup();
    renderAt('/facilities');
    await screen.findByRole('heading', { level: 1, name: 'Facilities' }, WAIT);
    expect(main().textContent).not.toMatch(/FHIR R4|HL7 v2|Last observation/);
    // In Live, the facility's quality points to where its feed is operated.
    expect(screen.getByRole('link', { name: 'Feed operations on Live Surveillance' }).getAttribute('href')).toBe('/live');
  });
});

describe('Roella', () => {
  const ask = (question: string) => answerText(answerQuestion(question, { day: 5, route: 'dashboard' }, {}).answer);
  it('tells Facilities, Live Surveillance, Laboratory Data and the Integration Demo apart', () => {
    expect(ask('What does the Facilities page show?')).toContain('facility contribution and data quality');
    expect(ask('Where do I see the source feeds?')).toContain('Open Live Surveillance in the sidebar');
    expect(ask('Where are the laboratory records?')).toContain('Open Laboratory Data in the sidebar');
    expect(ask('Where is the vendor sidecar?')).toContain('Open System → Integration Demo in the sidebar');
    expect(ask('Where can I see data quality?')).toContain('Open Facilities in the sidebar');
  });
});
