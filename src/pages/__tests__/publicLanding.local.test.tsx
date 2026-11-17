// @vitest-environment jsdom
/**
 * The public landing page at "/" and the sign-in screen it leads to at
 * /signin: content, routing (protected routes, return-to-route, SMART),
 * accessibility structure and reduced motion. Layout at 375–1440px is
 * measured in a real browser by the landing checker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { COPYRIGHT_NOTICE, TRADEMARK_NOTICE } from '../../lib/brand';
import { DEMO_SESSION_KEY, SIGN_IN_PATH } from '../../lib/demoSession';
import { signInForTest } from './signedIn';
import indexHtml from '../../../index.html?raw';

vi.mock('../../components/map/OutbreakMap', () => ({
  default: () => <div data-testid="outbreak-map" />,
}));

const calls: string[] = [];
const scrolls: (ScrollIntoViewOptions | boolean | undefined)[] = [];

beforeEach(() => {
  calls.length = 0;
  scrolls.length = 0;
  vi.stubGlobal('fetch', async (input: string) => {
    calls.push(String(input));
    throw new Error('Local mode must not make requests');
  });
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = (options?: ScrollIntoViewOptions | boolean) => {
    scrolls.push(options);
  };
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WAIT = { timeout: 5000 };
const SIGN_IN_FORM = { name: 'Sign in to Signal by ProbeSyQ' };
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
const landing = () => screen.getByTestId('public-landing');
const text = () => landing().textContent ?? '';

const signIn = async () => {
  const form = await screen.findByRole('form', SIGN_IN_FORM, WAIT);
  fireEvent.change(document.getElementById('signin-name') as HTMLInputElement, { target: { value: 'Avery Analyst' } });
  fireEvent.change(document.getElementById('signin-password') as HTMLInputElement, { target: { value: 'any-password' } });
  fireEvent.submit(form);
};

describe('PUBLIC ROOT', () => {
  it('"/" shows the landing page while signed out, not the sign-in form', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Signal by ProbeSyQ' }, WAIT)).toBeTruthy();
    expect(landing()).toBeTruthy();
    expect(screen.queryByRole('form', SIGN_IN_FORM)).toBeNull();
    expect(document.getElementById('signin-name')).toBeNull();
    expect(document.getElementById('signin-password')).toBeNull();
    // Public: no application chrome, no assistant, nothing fetched.
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask Roella' })).toBeNull();
    expect(calls).toEqual([]);
  });

  it('a signed-in visitor at "/" goes on to the Dashboard, in Live Surveillance', async () => {
    signInForTest();
    renderAt('/');
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    expect(screen.queryByTestId('public-landing')).toBeNull();
    expect(screen.getByTestId('dashboard-live')).toBeTruthy();
  });
});

describe('SIGN-IN', () => {
  it('the pill-shaped "Sign in" links open the existing sign-in screen', async () => {
    renderAt('/');
    await screen.findByTestId('public-landing', undefined, WAIT);
    const links = screen.getAllByRole('link', { name: 'Sign in' });
    // One compact link in the page header, one prominent call to action in the hero.
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(SIGN_IN_PATH);
      expect(link.className).toContain('rounded-full');
      expect(link.className).toContain('ls-btn-primary');
      expect(link.textContent).toBe('Sign in');
    }
    const hero = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement;
    const cta = within(hero).getByRole('link', { name: 'Sign in' });
    expect(cta.className).toContain('min-h-[44px]');
    expect(within(landing()).queryByRole('link', { name: /Get Started|Launch Demo|Enter App/i })).toBeNull();

    fireEvent.click(cta);
    const form = await screen.findByRole('form', SIGN_IN_FORM, WAIT);
    expect(screen.queryByTestId('public-landing')).toBeNull();
    expect(within(form).getByLabelText('Name')).toBeTruthy();
    expect((within(form).getByLabelText('Role') as HTMLInputElement).value).toBe('Public Health Analyst');
    expect(within(form).getByLabelText('Password')).toBeTruthy();
    expect(within(form).getByRole('button', { name: 'Show password' })).toBeTruthy();
    expect(within(form).getByRole('button', { name: 'Sign in' }).getAttribute('type')).toBe('submit');
  });

  it('the sign-in screen is unchanged: branding, validation, ownership notice', async () => {
    renderAt(SIGN_IN_PATH);
    const form = await screen.findByRole('form', SIGN_IN_FORM, WAIT);
    const main = document.querySelector('main') as HTMLElement;
    expect(main.className).toContain('ls-auth-backdrop');
    expect(screen.getByRole('heading', { level: 1, name: 'Signal by ProbeSyQ' })).toBeTruthy();
    expect(screen.getByText('Outbreak Intelligence')).toBeTruthy();
    expect(screen.getByTestId('ownership-notice').textContent).toBe(`${TRADEMARK_NOTICE} ${COPYRIGHT_NOTICE}`);
    fireEvent.submit(form);
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    fireEvent.change(document.getElementById('signin-name') as HTMLInputElement, { target: { value: 'Avery Analyst' } });
    fireEvent.submit(form);
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(window.sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it('landing → Sign in → sign-in → the Dashboard, in Live Surveillance', { timeout: 20000 }, async () => {
    renderAt('/');
    fireEvent.click((await screen.findAllByRole('link', { name: 'Sign in' }, WAIT))[1]);
    await signIn();
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    expect(screen.getByTestId('dashboard-live')).toBeTruthy();
    expect(JSON.parse(window.sessionStorage.getItem(DEMO_SESSION_KEY) ?? '{}').name).toBe('Avery Analyst');
  });
});

describe('ROUTING', () => {
  it('a signed-out deep link goes straight to sign-in (not the landing page) and returns there afterwards', { timeout: 30000 }, async () => {
    for (const [path, heading] of [
      ['/signals#queue', 'Signals & Alerts'],
      ['/facilities', 'Facilities'],
    ] as const) {
      renderAt(path);
      expect(await screen.findByRole('form', SIGN_IN_FORM, WAIT), path).toBeTruthy();
      expect(screen.queryByTestId('public-landing'), path).toBeNull();
      await signIn();
      expect(await screen.findByRole('heading', { level: 1, name: heading }, WAIT), path).toBeTruthy();
      cleanup();
      window.sessionStorage.clear();
    }
  });

  it('a signed-out /dashboard goes to sign-in and back to the Dashboard', { timeout: 20000 }, async () => {
    renderAt('/dashboard');
    await signIn();
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    expect(screen.getByTestId('dashboard-live')).toBeTruthy();
  });

  it('a signed-in visitor at /signin goes on to the Dashboard', async () => {
    signInForTest();
    renderAt(SIGN_IN_PATH);
    await screen.findByTestId('active-surveillance', undefined, WAIT);
    expect(screen.queryByRole('form', SIGN_IN_FORM)).toBeNull();
  });

  it('the SMART launch, callback and sidecar stay outside the sign-in gate and the landing page', async () => {
    for (const path of ['/smart/launch', '/smart/callback', '/smart/sidecar']) {
      renderAt(path);
      expect((await screen.findAllByText(/SMART/, {}, WAIT)).length, path).toBeGreaterThan(0);
      expect(screen.queryByRole('form', SIGN_IN_FORM), path).toBeNull();
      expect(screen.queryByTestId('public-landing'), path).toBeNull();
      cleanup();
    }
  });
});

describe('LANDING CONTENT', () => {
  beforeEach(async () => {
    renderAt('/');
    await screen.findByTestId('public-landing', undefined, WAIT);
  });

  it('brands the page Signal by ProbeSyQ · Outbreak Intelligence, with ProbeSyQ as the company', () => {
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Signal by ProbeSyQ');
    expect(within(h1).getByText('by ProbeSyQ').className).toMatch(/text-muted/);
    expect(text()).toContain('Outbreak Intelligence');
    expect(text()).toContain('ProbeSyQ · Healthcare Technology Systems');
    expect(text()).not.toMatch(/\b(LLC|Inc\.?|Corporation|Corp\.)\b|®|LabSentinel|ProbeSyQ Signal|capstone/i);
  });

  it('states the product summary and the laboratory → signal flow', () => {
    expect(screen.getByTestId('product-summary').textContent).toMatch(
      /^Signal by ProbeSyQ transforms laboratory and surveillance data into early-warning outbreak intelligence, helping public-health teams identify emerging patterns before they become obvious through traditional reporting\.$/,
    );
    const flow = screen.getByRole('list', { name: 'From laboratory data to early-warning signals' });
    expect(within(flow).getAllByRole('listitem').map((li) => li.textContent?.replace('→', '').trim())).toEqual([
      'Laboratory data', 'Interoperability', 'Analytics', 'Early-warning signals',
    ]);
  });

  it('shows six capabilities', () => {
    const section = screen.getByRole('heading', { level: 2, name: 'From routine laboratory results to outbreak intelligence' }).closest('section') as HTMLElement;
    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Early-warning surveillance', 'Multi-profile monitoring', 'Outbreak intelligence', 'Interoperability', 'Analytics & geography', 'Investigation workflow',
    ]);
  });

  it('explains the five-stage intelligence flow without implying a live connection', () => {
    const flow = screen.getByTestId('data-flow');
    expect([...flow.querySelectorAll(':scope > li')].map((li) => li.querySelector('.text-base')?.textContent)).toEqual([
      'Laboratory systems', 'Interoperability', 'Signal by ProbeSyQ', 'Analytics & surveillance', 'Early-warning intelligence',
    ]);
    expect(flow.closest('section')?.textContent).toContain('In this public version every stage runs on synthetic data; no laboratory or hospital system is connected.');
  });

  it('introduces Munyaradzi Chinorumba, and has no qualifications section', () => {
    const about = screen.getByRole('heading', { level: 2, name: 'Munyaradzi Chinorumba' }).closest('section') as HTMLElement;
    expect(about.id).toBe('about');
    expect(about.textContent).toContain(
      'Munyaradzi Chinorumba is a healthcare technology graduate student with a background in Medical Laboratory Sciences and a growing focus on healthcare AI, data interoperability, analytics and clinical information systems.',
    );
    expect(within(within(about).getByRole('list', { name: 'Signal by ProbeSyQ brings together' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Laboratory science', 'Healthcare technology', 'Interoperability', 'Analytics', 'AI-enabled healthcare innovation',
    ]);
    // No résumé-style section of any kind.
    expect(screen.queryByTestId('qualifications')).toBeNull();
    expect(text()).not.toMatch(/Qualifications|Education|Certification|Skills|Clark University|BSc\b|Master’s/i);
    expect(within(about).queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('states the mission, and what it means for Signal', () => {
    expect(screen.getByTestId('mission-statement').textContent).toBe(
      '“My goal is to bring together AI, data interoperability, data analytics and clinical laboratory knowledge to build healthcare technology systems that improve how health information is connected, interpreted and acted upon.”',
    );
    expect(within(screen.getByTestId('mission-parts')).getAllByRole('listitem').map((li) => li.textContent?.replace('+', '').trim())).toEqual([
      'AI', 'Data interoperability', 'Data analytics', 'Clinical laboratory knowledge',
    ]);
    const mission = screen.getByTestId('mission-statement').closest('section') as HTMLElement;
    for (const aim of [/Outbreak intelligence/, /public-health surveillance/, /Earlier recognition of disease patterns/, /routine laboratory data/]) {
      expect(mission.textContent).toMatch(aim);
    }
  });

  it('discloses the public version honestly, below the hero, with the ownership notice in the footer', () => {
    const disclosure = screen.getByTestId('landing-disclosure');
    for (const point of [
      'Uses synthetic data only. No real patient data.',
      'A portfolio prototype, not a production system.',
      'Not connected to any real hospital, laboratory or EHR.',
      'Not clinically validated, and not for public-health decisions.',
    ]) {
      expect(disclosure.textContent).toContain(point);
    }
    const hero = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement;
    expect(hero.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByTestId('ownership-notice').textContent).toBe(
      'ProbeSyQ™ and Signal by ProbeSyQ™ are trademarks claimed by their owner. © 2026 Munyaradzi Chinorumba. All rights reserved.',
    );
  });
});

describe('ACCESSIBILITY', () => {
  beforeEach(async () => {
    renderAt('/');
    await screen.findByTestId('public-landing', undefined, WAIT);
  });

  it('has one h1, sections in order, and no skipped heading level', () => {
    const headings = [...landing().querySelectorAll('h1, h2, h3, h4, h5, h6')];
    expect(headings.filter((h) => h.tagName === 'H1')).toHaveLength(1);
    expect(headings.filter((h) => h.tagName === 'H2').map((h) => h.textContent)).toEqual([
      'From routine laboratory results to outbreak intelligence',
      'How the intelligence flow works',
      'Munyaradzi Chinorumba',
      'Connecting health information so it can be interpreted and acted upon',
      'About this public version',
    ]);
    let previous = 1;
    for (const h of headings) {
      const level = Number(h.tagName[1]);
      expect(level, h.textContent ?? '').toBeLessThanOrEqual(previous + 1);
      previous = level;
    }
    for (const section of landing().querySelectorAll('section')) {
      const id = section.getAttribute('aria-labelledby');
      expect(id && document.getElementById(id), id ?? 'section').toBeTruthy();
    }
  });

  it('has a banner, a page-sections nav, a main and a footer; the skip link comes first', () => {
    expect(within(landing()).getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('landing-main');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Capabilities', '#capabilities'], ['How it works', '#how-it-works'], ['About', '#about'],
    ]);
    // Every in-page link points at something that exists.
    for (const a of landing().querySelectorAll('a[href^="#"]')) {
      expect(document.getElementById(a.getAttribute('href')!.slice(1)), a.getAttribute('href')!).toBeTruthy();
    }
    const first = landing().querySelector('a, button, input, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    expect(first.textContent).toBe('Skip to content');
    expect(first.getAttribute('href')).toBe('#landing-main');
  });

  it('section links scroll to the section and move keyboard focus to its heading', () => {
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Page sections' })).getByRole('link', { name: 'About' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Munyaradzi Chinorumba' }));
    fireEvent.click(screen.getByRole('link', { name: /See how it works/ }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'How the intelligence flow works' }));
    expect(scrolls).toHaveLength(2);
  });

  it('hides the decorative illustration and icons from assistive technology', () => {
    expect(screen.getByTestId('landing-visual').getAttribute('aria-hidden')).toBe('true');
    for (const svg of landing().querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden'), svg.outerHTML.slice(0, 60)).toBe('true');
    }
  });
});

describe('MOTION', () => {
  const preferReducedMotion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));

  it('animates only the illustration by default', async () => {
    preferReducedMotion(false);
    renderAt('/');
    await screen.findByTestId('public-landing', undefined, WAIT);
    const animated = document.querySelectorAll('.ls-landing-flow, .ls-landing-pulse');
    expect(animated.length).toBeGreaterThan(0);
    for (const el of animated) expect(screen.getByTestId('landing-visual').contains(el)).toBe(true);
  });

  it('draws the illustration still under prefers-reduced-motion (the early-warning ring stays)', async () => {
    preferReducedMotion(true);
    renderAt('/');
    await screen.findByTestId('public-landing', undefined, WAIT);
    expect(document.querySelectorAll('.ls-landing-flow, .ls-landing-pulse')).toHaveLength(0);
    expect(document.querySelectorAll('[style*="animation"]')).toHaveLength(0);
    expect(screen.getByTestId('landing-visual').querySelectorAll('circle[stroke="#F97316"]').length).toBeGreaterThan(0);
  });

  it('section links jump without smooth scrolling when reduced motion is preferred', async () => {
    preferReducedMotion(true);
    renderAt('/');
    await screen.findByTestId('public-landing', undefined, WAIT);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Page sections' })).getByRole('link', { name: 'Capabilities' }));
    expect(scrolls[scrolls.length - 1]).toEqual({ behavior: 'auto', block: 'start' });
  });
});

describe('METADATA', () => {
  it('keeps the product title and describes the page without overclaiming', () => {
    expect(indexHtml).toContain('<title>Signal by ProbeSyQ — Outbreak Intelligence</title>');
    const description = indexHtml.match(/name="description"\s+content="([^"]+)"/)?.[1] ?? '';
    expect(description).toContain('early-warning outbreak intelligence built around laboratory data, interoperability and healthcare analytics');
    expect(description).toContain('synthetic data only');
    expect(description).not.toMatch(/validated|real-time|AI-powered|leading|#1/i);
  });
});
