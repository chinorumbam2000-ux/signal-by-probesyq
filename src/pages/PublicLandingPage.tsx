import { useCallback, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/common/BrandMark';
import OwnershipNotice from '../components/common/OwnershipNotice';
import SignalNetworkVisual from '../components/landing/SignalNetworkVisual';
import {
  BellIcon,
  ChartMapIcon,
  ClipboardIcon,
  ExchangeIcon,
  FlaskIcon,
  InfoIcon,
  LayersIcon,
  PulseIcon,
  RadarIcon,
} from '../components/landing/LandingIcons';
import { COMPANY_NAME, COMPANY_TAGLINE, OWNER_LEGAL_NAME } from '../lib/brand';
import { SIGN_IN_PATH } from '../lib/demoSession';

/**
 * The public landing page at "/": what Signal by ProbeSyQ is (hero), what it
 * does, how it works, the mission behind it, who built it, and the one
 * authoritative note on what this public version is. Each section has one job. Its one call to action, "Sign in", opens the
 * existing sign-in screen at /signin.
 *
 * Like the sign-in screen, the page is its own scroll container (the document
 * never scrolls: see index.css). The section links scroll within it and move
 * focus to the section, without adding history entries.
 */

const HERO_FLOW = ['Laboratory data', 'Interoperability', 'Analytics', 'Early-warning signals'];

const CAPABILITIES: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: 'Early-warning surveillance',
    text: 'Turns shifts in routine laboratory results into surveillance signals, ranked for review.',
    icon: <PulseIcon />,
  },
  {
    title: 'Multi-profile monitoring',
    text: 'Watches an aggregate respiratory profile alongside pathogen-specific surveillance profiles.',
    icon: <LayersIcon />,
  },
  {
    title: 'Outbreak intelligence',
    text: 'Combines testing activity, positivity, geography, persistence and facility spread into one composite signal.',
    icon: <RadarIcon />,
  },
  {
    title: 'Interoperability',
    text: 'Designed around healthcare data-exchange concepts such as FHIR, HL7 and laboratory information systems.',
    icon: <ExchangeIcon />,
  },
  {
    title: 'Analytics & geography',
    text: 'Trends, facility contribution and geographic views show where a signal is building.',
    icon: <ChartMapIcon />,
  },
  {
    title: 'Investigation workflow',
    text: 'Carries an alert through review and investigation to a public-health report.',
    icon: <ClipboardIcon />,
  },
];

const FLOW: { title: string; text: string; icon: ReactNode }[] = [
  { title: 'Laboratory systems', text: 'Test orders and results from laboratory information systems.', icon: <FlaskIcon /> },
  { title: 'Interoperability', text: 'HL7 and FHIR messages, normalized to standard codes such as LOINC.', icon: <ExchangeIcon /> },
  {
    title: 'Signal by ProbeSyQ',
    text: 'Routes each observation to the surveillance profiles it belongs to.',
    icon: <BrandMark size={20} reduced className="h-5 w-5" />,
  },
  { title: 'Analytics & surveillance', text: 'Compares activity with its baseline, by facility and by region.', icon: <ChartMapIcon /> },
  { title: 'Early-warning intelligence', text: 'Signals, alerts and maps for epidemiological review.', icon: <BellIcon /> },
];

const DISCLOSURE = [
  'Uses synthetic data only. No real patient data.',
  'A portfolio prototype, not a production system.',
  'Not connected to any real hospital, laboratory or EHR.',
  'Not clinically validated, and not for public-health decisions.',
];

const SECTIONS = [
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'about', label: 'About' },
];

/** The pill-shaped Sign in link (it navigates, so it is a link). */
function SignInLink({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Link
      to={SIGN_IN_PATH}
      className={`ls-btn-primary rounded-full shadow-card ${
        size === 'md' ? 'min-h-[44px] px-7 py-2.5 text-base' : 'min-h-[36px] px-4 py-1.5 text-sm'
      }`}
    >
      Sign in
    </Link>
  );
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="min-w-0 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0F766E]">{eyebrow}</p>
      <h2 id={id} tabIndex={-1} className="mt-2 text-2xl font-semibold tracking-tight text-ink focus:outline-none sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

function IconTile({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'teal' }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
        tone === 'brand' ? 'bg-brand-light text-brand' : 'bg-[#E6F5F2] text-[#0F766E]'
      }`}
    >
      {children}
    </span>
  );
}

export default function PublicLandingPage() {
  // Section links: scroll within the page and move focus to the section's heading.
  const goTo = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const heading = document.getElementById(`${id}-title`);
    if (!heading) return;
    event.preventDefault();
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.closest('section')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  }, []);

  return (
    <div className="ls-shell overflow-y-auto overflow-x-hidden bg-white" data-testid="public-landing">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand focus:shadow-panel"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-hairline/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={32} className="h-8 w-8 shrink-0" />
            <span className="truncate text-base font-semibold tracking-tight text-ink">
              Signal <span className="text-sm font-medium text-muted">by ProbeSyQ</span>
            </span>
          </span>
          <div className="flex items-center gap-1 sm:gap-3">
            <nav aria-label="Page sections" className="hidden md:block">
              <ul className="flex items-center gap-1">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={(event) => goTo(event, section.id)}
                      className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <SignInLink size="sm" />
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1} className="focus:outline-none">
        {/* 1. Hero */}
        <section className="ls-landing-hero relative overflow-hidden" aria-labelledby="landing-title">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pb-20 lg:pt-20">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#B7E4DC] bg-[#E6F5F2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0F766E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6]" aria-hidden="true" />
                Outbreak Intelligence
              </p>
              <h1 id="landing-title" className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
                Signal <span className="font-medium text-muted">by ProbeSyQ</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#334155]" data-testid="product-summary">
                Signal by ProbeSyQ transforms laboratory and surveillance data into early-warning outbreak intelligence,
                helping public-health teams identify emerging patterns before they become obvious through traditional reporting.
              </p>

              <ol aria-label="From laboratory data to early-warning signals" className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-2" data-testid="hero-flow">
                {HERO_FLOW.map((step, index) => (
                  <li key={step} className="flex items-center gap-1.5">
                    {/* The arrow leads into its step, so a wrapped row starts with it. */}
                    {index > 0 ? (
                      <span aria-hidden="true" className="text-sm text-muted">
                        →
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.06em] ${
                        index === HERO_FLOW.length - 1
                          ? 'border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]'
                          : 'border-hairline bg-white text-[#1E3A5F]'
                      }`}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <SignInLink />
                <a
                  href="#how-it-works"
                  onClick={(event) => goTo(event, 'how-it-works')}
                  className="rounded-full px-1 py-2 text-sm font-semibold text-brand underline-offset-4 hover:underline"
                >
                  See how it works <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>

            <figure className="min-w-0">
              <div className="ls-landing-visual rounded-[24px] p-1.5 shadow-panel ring-1 ring-[#163E66]/10">
                <SignalNetworkVisual className="block h-auto w-full" />
              </div>
              <figcaption className="mt-3 text-center text-xs text-muted">Illustration of the Signal intelligence flow.</figcaption>
            </figure>
          </div>
        </section>

        {/* 2. What Signal does */}
        <section id="capabilities" aria-labelledby="capabilities-title" className="scroll-mt-16 border-t border-hairline bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionHeading id="capabilities-title" eyebrow="Capabilities" title="What Signal does" />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="capabilities">
              {CAPABILITIES.map((capability) => (
                <li key={capability.title} className="ls-card flex flex-col p-5 transition-shadow hover:shadow-panel">
                  <IconTile>{capability.icon}</IconTile>
                  <h3 className="mt-4 text-base font-semibold text-ink">{capability.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{capability.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. How Signal works */}
        <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-16 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionHeading id="how-it-works-title" eyebrow="Data flow" title="How Signal works" />
            <ol className="ls-landing-steps mt-10 grid gap-3 md:grid-cols-5 md:gap-0" data-testid="data-flow">
              {FLOW.map((step, index) => (
                <li key={step.title} className="ls-landing-step relative flex gap-4 md:flex-col md:gap-0 md:px-3">
                  <span
                      className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                        index === 2
                          ? 'border-[#163E66] bg-[#163E66] text-white'
                          : index === FLOW.length - 1
                            ? 'border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]'
                            : 'border-hairline bg-white text-brand shadow-card'
                      }`}
                    >
                      {step.icon}
                    </span>
                  <span className="min-w-0 pb-2 md:mt-4 md:pb-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Stage {index + 1}</span>
                    <span className="mt-0.5 block text-base font-semibold text-ink">{step.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-8 inline-flex items-start gap-2 rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm text-[#334155]">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              This public prototype is not connected to any real laboratory, hospital or EHR system.
            </p>
          </div>
        </section>

        {/* 4. Mission */}
        <section aria-labelledby="mission-title" className="ls-landing-mission relative overflow-hidden text-white">
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="mission-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7DD3C0]">
              Mission
            </h2>
            <figure className="mt-6 max-w-4xl border-l-2 border-[#4DB6A5] pl-5 sm:pl-6">
              <blockquote>
                <p className="text-xl font-medium leading-relaxed text-white sm:text-2xl sm:leading-relaxed" data-testid="mission-statement">
                “My goal is to bring together AI, data interoperability, data analytics and clinical laboratory knowledge to
                build healthcare technology systems that improve how health information is connected, interpreted and acted
                upon.”
                </p>
              </blockquote>
              <figcaption className="mt-4 text-sm font-medium text-[#B6C6DA]">{OWNER_LEGAL_NAME}</figcaption>
            </figure>
            <p className="mt-8 max-w-3xl text-base leading-relaxed text-[#CBD5E1]">
              For Signal, that means turning routine laboratory data into earlier, actionable public-health intelligence.
            </p>
          </div>
        </section>

        {/* 5. About the creator */}
        <section id="about" aria-labelledby="about-title" className="scroll-mt-16 border-b border-hairline bg-canvas">
          <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-20">
            <div className="flex min-w-0 items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#163E66] to-[#2563EB] text-lg font-semibold text-white"
                aria-hidden="true"
              >
                MC
              </span>
              <SectionHeading id="about-title" eyebrow="About the creator" title={OWNER_LEGAL_NAME} />
            </div>
            <div className="min-w-0 space-y-4 text-base leading-relaxed text-[#334155] sm:text-lg sm:leading-relaxed" data-testid="about-creator">
              <p>
                Munyaradzi Chinorumba is a healthcare technology graduate student with a background in Medical Laboratory
                Sciences and a growing focus on healthcare AI, data interoperability, analytics and clinical information systems.
              </p>
              <p>Signal by ProbeSyQ is where those fields meet.</p>
            </div>
          </div>
        </section>

        {/* 6. Public portfolio disclosure */}
        <section aria-labelledby="disclosure-title" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="rounded-2xl border border-hairline bg-canvas p-5 sm:p-6" data-testid="landing-disclosure">
              <h2 id="disclosure-title" className="flex items-center gap-2 text-base font-semibold text-ink">
                <InfoIcon className="h-5 w-5 shrink-0 text-brand" />
                About this public version
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {DISCLOSURE.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm leading-relaxed text-[#334155]">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <footer className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark size={28} className="h-7 w-7 shrink-0" />
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">Signal by ProbeSyQ</span>
              <span className="block text-xs">
                <span className="font-semibold text-ink">{COMPANY_NAME}</span> · {COMPANY_TAGLINE}
              </span>
            </p>
          </div>
          <OwnershipNotice className="max-w-md sm:text-right" />
        </div>
      </footer>
    </div>
  );
}
