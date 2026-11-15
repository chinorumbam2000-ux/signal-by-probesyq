import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import Card from '../components/common/Card';
import PageMeta from '../components/common/PageMeta';
import DataConfidenceCard from '../components/common/DataConfidenceCard';
import { PrivacyDisclosure } from '../components/common/PrivacyValue';
import { usePortfolio } from '../lib/profiles/usePortfolio';
import ProfileSelector from '../components/profiles/ProfileSelector';
import ProfileHeading from '../components/profiles/ProfileHeading';
import { ErrorState, LoadingState } from '../components/common/States';
import FacilityStatusOverview from '../components/hospitals/FacilityStatusOverview';
import FacilityDataQuality from '../components/hospitals/FacilityDataQuality';
import HospitalDashboard from '../components/hospitals/HospitalDashboard';
import type { HospitalId } from '../types';

const isFacilityId = (value: string | null): value is HospitalId =>
  value === 'HOSP-A' || value === 'HOSP-B' || value === 'HOSP-C';

/**
 * Facilities: the participating laboratory sources, for the selected
 * surveillance profile (route /facilities; the former /hospitals address
 * redirects here). It answers what each facility contributes to the profile
 * and how far its data can be trusted:
 *
 *   - the facilities at a glance (reporting, contribution, positivity, a
 *     one-line data-quality summary);
 *   - the selected facility's activity (tests, positivity, first signal, two
 *     compact trends), with a link to its records on Laboratory Data;
 *   - data quality: the facility's own quality evidence, and the full Data
 *     Confidence breakdown (its main home), which never changes the score.
 *
 * Feed operations are on Live Surveillance, records on Laboratory Data, signal
 * reasoning on Signals and Investigations, and the EHR sidecar demonstration
 * under System → Integration Demo. ?facility=<code> selects a facility.
 */
export default function HospitalsPage() {
  const { facilities, isLoading, error, clearError } = useSimulation();
  // Facility figures follow the selected surveillance profile (?profile=).
  const portfolio = usePortfolio();
  const { hospitalMetrics, profile } = portfolio.view;
  const { period } = portfolio;
  const isLive = period.mode === 'live';
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('facility');

  const [activeId, setActiveId] = useState<HospitalId>(isFacilityId(requested) ? requested : 'HOSP-A');
  // Facility identity comes from the active data source. The per-day metrics
  // are still built from the prototype's site counts, keyed by facility code.
  const activeHospital = facilities.find((hospital) => hospital.id === activeId) ?? facilities[0];
  const siteMetrics =
    hospitalMetrics.find((item) => item.hospital.id === activeHospital.id) ??
    hospitalMetrics[0];
  const metrics = { ...siteMetrics, hospital: activeHospital };
  const activeFeed = period.feedHealth.find((feed) => feed.hospitalId === activeHospital.id);
  const profileParam = encodeURIComponent(profile.id);
  const recordsPath = `/laboratory-data?profile=${profileParam}&facility=${encodeURIComponent(activeHospital.id)}`;

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={clearError} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Facilities</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            What each participating facility contributes to the selected profile, and how far its data can be trusted.
          </p>
        </div>
        <PageMeta />
      </header>

      <ProfileSelector portfolio={portfolio} />

      {isLoading || !metrics ? (
        <Card>
          <LoadingState label="Loading facility data…" />
        </Card>
      ) : (
        <>
          <ProfileHeading view={portfolio.view} compact />

          <FacilityStatusOverview
            facilities={facilities}
            feeds={period.feedHealth}
            metrics={hospitalMetrics}
            selectedId={activeHospital.id}
            onSelect={setActiveId}
            profileName={profile.displayName}
            positivityText={portfolio.view.display.facilityPositivity}
          />

          <section aria-labelledby="facility-detail-title" className="space-y-4" data-testid="facility-detail">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="facility-detail-title" className="text-lg font-semibold tracking-tight text-ink">
                  {activeHospital.name}
                </h2>
                <p className="text-xs text-muted">
                  {activeHospital.city}, {activeHospital.state} {activeHospital.zipCode} · {profile.displayName} figures
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Link to={recordsPath} className="font-semibold text-brand hover:underline" data-testid="facility-records-link">
                  View this facility&apos;s laboratory records <span aria-hidden="true">→</span>
                </Link>
                <Link to={`/signals?profile=${profileParam}`} className="font-semibold text-brand hover:underline">
                  Review signal evidence <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            <HospitalDashboard
              metrics={metrics}
              currentDay={period.day}
              label={period.label}
              privacy={{ on: (day) => portfolio.view.display.facilityOn(activeHospital.id, day) }}
            />
          </section>

          <section aria-labelledby="data-quality-title" className="space-y-3" data-testid="facilities-data-quality">
            <div>
              <h2 id="data-quality-title" className="text-lg font-semibold tracking-tight text-ink">
                Data quality
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                How far the data can be trusted: {activeHospital.name}&apos;s own evidence, and Data Confidence across
                every participating source. Data Confidence never changes the outbreak score.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <FacilityDataQuality
                facility={activeHospital}
                feed={activeFeed}
                liveFeedsPath={isLive ? '/dashboard' : undefined}
              />
              <DataConfidenceCard confidence={period.dataConfidence} showFacts={false} breakdownOpen />
            </div>
          </section>

          <PrivacyDisclosure summary={portfolio.view.privacy.summary} />
        </>
      )}
    </div>
  );
}
