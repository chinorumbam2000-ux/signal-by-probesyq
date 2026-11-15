import type { FacilityFeedHealth, Hospital, HospitalId, HospitalMetrics } from '../../types';
import { FEED_STATUS_STYLES } from '../common/FeedHealthCard';
import SeverityBadge from '../signals/SeverityBadge';

export const REPORTING_LABEL: Record<FacilityFeedHealth['status'], string> = {
  HEALTHY: 'Reporting',
  DELAYED: 'Delayed',
  DEGRADED: 'Degraded',
  OFFLINE: 'No data',
};

/** A facility's reporting status, in words beside its colour. */
export function ReportingStatus({ feed }: { feed: FacilityFeedHealth | undefined }) {
  if (!feed) return <span className="text-muted">Unknown</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${FEED_STATUS_STYLES[feed.status].badge}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${FEED_STATUS_STYLES[feed.status].dot}`} />
      {REPORTING_LABEL[feed.status]}
    </span>
  );
}

/**
 * Every participating facility at a glance, for the selected profile: is it
 * reporting, what does it contribute (its tests and whether it is part of the
 * signal), its positivity, and a one-line data-quality summary. The full
 * quality detail and the Data Confidence breakdown are in the facility's
 * Data quality section; feed operations (source type, last observation,
 * message counts) are on Live Surveillance.
 *
 * Reporting status comes from the app's simulated feed telemetry (the same
 * model Data Confidence uses); contribution comes from the day's facility
 * metrics. Contribution and data quality are kept apart: neither is folded
 * into the other.
 */
export default function FacilityStatusOverview({
  facilities,
  feeds,
  metrics,
  selectedId,
  onSelect,
  profileName,
  positivityText = (_id, rate) => `${rate.toFixed(1)}%`,
}: {
  facilities: Hospital[];
  feeds: FacilityFeedHealth[];
  metrics: HospitalMetrics[];
  selectedId: HospitalId;
  onSelect: (id: HospitalId) => void;
  /** The selected profile, named in the contribution column. */
  profileName: string;
  /** A facility's positivity as it may be shown: withheld ("<5") when its count is. */
  positivityText?: (id: HospitalId, rate: number) => string;
}) {
  const reporting = feeds.filter((feed) => feed.isReporting).length;
  const issues = feeds.filter((feed) => feed.status !== 'HEALTHY').length;
  const totalTests = metrics.reduce((sum, site) => sum + site.totalTests, 0);

  return (
    <section aria-labelledby="facility-status-title" className="ls-card" data-testid="facility-overview">
      <header className="ls-card-header">
        <div>
          <h2 id="facility-status-title" className="ls-card-title">Facility overview</h2>
          <p className="mt-0.5 text-xs text-muted">
            {reporting} of {facilities.length} facilities reporting
            {issues > 0 ? ` · ${issues} with a feed issue` : ' · all feeds healthy'}
          </p>
        </div>
      </header>

      {/* Focusable, so the table can be scrolled sideways from the keyboard on narrow screens. */}
      <div className="w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Facility status table">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <caption className="sr-only">
            Reporting status, contribution to {profileName}, positivity and data quality for each facility
          </caption>
          <thead className="border-b border-hairline bg-canvas">
            <tr>
              <th scope="col" className="ls-th">Facility</th>
              <th scope="col" className="ls-th">Reporting</th>
              <th scope="col" className="ls-th">Contribution</th>
              <th scope="col" className="ls-th">Positivity</th>
              <th scope="col" className="ls-th">Data quality</th>
              <th scope="col" className="ls-th text-right">
                <span className="sr-only">Show details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {facilities.map((facility) => {
              const feed = feeds.find((item) => item.hospitalId === facility.id);
              const site = metrics.find((item) => item.hospital.id === facility.id);
              const selected = facility.id === selectedId;
              const share = site && totalTests > 0 ? Math.round((site.totalTests / totalTests) * 100) : 0;
              return (
                <tr key={facility.id} data-testid="facility-row" aria-current={selected ? 'true' : undefined}>
                  {/* The selected facility is marked by an accent bar (and its pressed Details button), not a tint
                      that would lower the contrast of the badges in the row. */}
                  <th
                    scope="row"
                    className={`border-l-4 px-4 py-3 text-left font-normal ${selected ? 'border-l-brand' : 'border-l-transparent'}`}
                  >
                    <span className="block font-medium text-ink">{facility.name}</span>
                    <span className="block text-xs text-muted">
                      {facility.city}, {facility.state} {facility.zipCode}
                    </span>
                  </th>
                  <td className="ls-td">
                    <ReportingStatus feed={feed} />
                  </td>
                  <td className="ls-td" data-testid="facility-contribution">
                    {site?.isAffected ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <SeverityBadge severity={site.severity} />
                        <span className="text-xs text-ink">In the signal</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Not in the signal</span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {site ? `${site.totalTests.toLocaleString('en-US')} tests · ${share}% of the profile's` : '—'}
                    </span>
                  </td>
                  <td className="ls-td tabular-nums">{site ? positivityText(site.hospital.id, site.positivityRate) : '—'}</td>
                  <td className="ls-td text-xs" data-testid="facility-quality-summary">
                    {feed?.isReporting ? (
                      <span className="text-ink">
                        {feed.completenessPercent.toFixed(0)}% complete · {feed.terminologyMappedPercent.toFixed(0)}% mapped
                      </span>
                    ) : (
                      <span className="text-muted">No data — quality unknown</span>
                    )}
                  </td>
                  <td className="ls-td text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(facility.id)}
                      aria-pressed={selected}
                      className={selected ? 'ls-btn-primary px-3 py-1.5 text-xs' : 'ls-btn px-3 py-1.5 text-xs'}
                    >
                      Details<span className="sr-only"> for {facility.name}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
