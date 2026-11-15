import { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import Card from '../components/common/Card';
import { ErrorState, LoadingState } from '../components/common/States';
import VendorSidecar from '../components/hospitals/VendorSidecar';
import IntegrationDetails from '../components/hospitals/IntegrationDetails';
import { useLiveSurveillance } from '../context/LiveSurveillanceContext';
import type { HospitalId } from '../types';
import { PROFILE_BY_ID, RVS_PROFILE_ID } from '../lib/profiles/registry';

/**
 * Each simulated environment gets a visually distinct but entirely generic
 * shell. None of these imitate a real vendor's proprietary interface.
 */
const ENVIRONMENT_THEMES: Record<
  HospitalId,
  { chromeClass: string; accentClass: string; moduleLabels: string[] }
> = {
  'HOSP-A': {
    chromeClass: 'bg-[#123A63]',
    accentClass: 'text-[#8FC0F0]',
    moduleLabels: ['Chart Review', 'Results', 'Orders', 'Notes'],
  },
  'HOSP-B': {
    chromeClass: 'bg-[#1F3B4D]',
    accentClass: 'text-[#7FD0C4]',
    moduleLabels: ['Patient Summary', 'Lab Results', 'Care Plan', 'Messages'],
  },
  'HOSP-C': {
    chromeClass: 'bg-[#2E2A47]',
    accentClass: 'text-[#B8AEE8]',
    moduleLabels: ['Worklist', 'Laboratory', 'Documentation', 'Inbox'],
  },
};

/**
 * System → Integration Demo (/integration-demo): the clinician sidecar inside
 * three simulated EHR environments, and how each facility's synthetic data
 * reaches Signal by ProbeSyQ. An integration demonstration, kept apart from
 * the analyst's Facilities page (surveillance contribution and data quality).
 * The SMART on FHIR sandbox launch and its sidecar (/smart/sidecar) are
 * separate and unchanged.
 */
export default function IntegrationDemoPage() {
  const { currentDay, currentScenario, signalScore, facilities, dataConfidence, feedHealth, isLoading, error, clearError } =
    useSimulation();
  const isLive = useLiveSurveillance().mode === 'live';
  const [activeId, setActiveId] = useState<HospitalId>('HOSP-A');
  const activeHospital = facilities.find((hospital) => hospital.id === activeId) ?? facilities[0];
  const activeFeed = feedHealth.find((feed) => feed.hospitalId === activeHospital?.id) ?? feedHealth[0];
  const theme = activeHospital ? ENVIRONMENT_THEMES[activeHospital.id] : ENVIRONMENT_THEMES['HOSP-A'];

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={clearError} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Integration Demo</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          One Signal by ProbeSyQ sidecar inside three simulated EHR environments. A demonstration of how the
          sidecar could sit beside a clinician&apos;s workspace — not a connection to, or a partnership with, Epic,
          Oracle Health or MEDITECH. All data is synthetic.
        </p>
      </header>

      {isLoading || !activeHospital ? (
        <Card>
          <LoadingState label="Loading the simulated environments…" />
        </Card>
      ) : (
        <>
          <section aria-labelledby="sidecar-title" className="space-y-3">
            <div>
              <h2 id="sidecar-title" className="text-lg font-semibold tracking-tight text-ink">
                Clinician sidecar
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                The EHR shell changes for every vendor. The Signal sidecar inside it does not — it is the same
                component rendered in all three. The standards-based SMART launch against a public sandbox is separate
                (System → Integration Testing, when enabled).
              </p>
              <p className="mt-1 max-w-3xl text-sm text-ink" data-testid="sidecar-scope">
                This sidecar is a {PROFILE_BY_ID[RVS_PROFILE_ID].displayName} example: it shows Scenario Replay&apos;s
                figures for Replay Day {currentDay}.
              </p>
            </div>

            <div className="rounded-xl border border-hairline bg-white p-3 shadow-card">
              <p className="ls-label mb-2">Vendor Environment</p>
              <div role="tablist" aria-label="Simulated vendor environments" className="flex flex-wrap gap-2">
                {facilities.map((hospital) => {
                  const isActive = hospital.id === activeHospital.id;
                  return (
                    <button
                      key={hospital.id}
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      onClick={() => setActiveId(hospital.id)}
                      className={`rounded-lg border px-4 py-2 text-left transition-colors ${
                        isActive ? 'border-brand bg-brand-light' : 'border-hairline bg-white hover:bg-canvas'
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${isActive ? 'text-brand' : 'text-ink'}`}>
                        {hospital.vendor}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {hospital.name} · {hospital.zipCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {/* Generic simulated EHR shell — deliberately not a vendor UI clone. */}
              <div className="ls-card overflow-hidden xl:col-span-2">
                <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${theme.chromeClass}`}>
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded bg-white/15 text-[11px] font-bold text-white"
                  >
                    {activeHospital.vendor.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{activeHospital.environmentLabel}</p>
                    <p className={`truncate text-[11px] ${theme.accentClass}`}>
                      Generic demonstration shell — not a reproduction of any vendor interface
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 border-b border-hairline bg-canvas px-4 py-2">
                  {theme.moduleLabels.map((label, index) => (
                    <span
                      key={label}
                      className={`rounded px-2.5 py-1 text-[11px] font-medium ${
                        index === 1 ? 'bg-white text-ink shadow-card' : 'text-muted'
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="p-5">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="ls-label">Facility</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">{activeHospital.name}</dd>
                    </div>
                    <div>
                      <dt className="ls-label">Vendor</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">{activeHospital.vendor}</dd>
                    </div>
                    <div>
                      <dt className="ls-label">ZIP</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums text-ink">
                        {activeHospital.zipCode} · {activeHospital.city}, {activeHospital.state}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-lg border border-dashed border-hairline bg-canvas p-4">
                    <p className="text-xs leading-relaxed text-muted">
                      This panel stands in for the host EHR workspace. Signal by ProbeSyQ is embedded beside it as a
                      SMART-on-FHIR style sidecar and receives only normalized, de-identified synthetic Observation
                      resources — never chart content, never patient identifiers beyond the synthetic placeholders shown
                      in this scenario.
                    </p>
                  </div>
                </div>
              </div>

              {/* The SAME reusable sidecar renders in every environment. */}
              <div className="xl:col-span-1">
                {isLive ? (
                  // The sidecar narrates Scenario Replay's figures: never shown beside live ones.
                  <p role="note" className="ls-card border-l-4 border-l-brand px-4 py-3 text-sm text-ink" data-testid="sidecar-live-note">
                    The EHR sidecar demonstration follows Scenario Replay in this release. Switch to Scenario Replay to
                    see it beside the simulated EHR.
                  </p>
                ) : (
                  <>
                    <VendorSidecar
                      scenario={currentScenario}
                      score={signalScore}
                      confidence={dataConfidence}
                      feed={activeFeed}
                    />
                    <p className="mt-2 px-1 text-[11px] leading-snug text-muted">
                      Rendered from a single shared <code className="font-mono">VendorSidecar</code> component —
                      identical in all three environments.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          <IntegrationDetails facility={activeHospital} feed={activeFeed} />
        </>
      )}
    </div>
  );
}
