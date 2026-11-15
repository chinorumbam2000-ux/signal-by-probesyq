import { Link } from 'react-router-dom';
import type { FacilityFeedHealth, Hospital } from '../../types';
import { formatMinutesAgo } from '../../lib/dataConfidence';
import { ReportingStatus } from './FacilityStatusOverview';

/**
 * One facility's data quality: the evidence Data Confidence is built from,
 * for this facility — whether it is reporting, how fresh, complete and well
 * mapped its data is, and how many events failed or were duplicated.
 *
 * Feed operations (source type, message counts, latency, the operational
 * note) belong to Live Surveillance; this is the quality of the data, not the
 * running of the feed. A facility with no data is unknown, never reassuring.
 */
export default function FacilityDataQuality({
  facility,
  feed,
  liveFeedsPath,
}: {
  facility: Hospital;
  feed: FacilityFeedHealth | undefined;
  /** The Dashboard, where Live Surveillance and its feeds are operated (Live mode only). */
  liveFeedsPath?: string;
}) {
  const rows: Array<[string, string]> = feed?.isReporting
    ? [
        ['Freshness', `Last event ${formatMinutesAgo(feed.minutesSinceLastEvent)}`],
        ['Completeness', `${feed.completenessPercent.toFixed(1)}% of records carry the fields the signal needs`],
        ['Terminology mapping', `${feed.terminologyMappedPercent.toFixed(1)}% of results mapped to LOINC`],
        ['Integrity', `${feed.failedEvents} failed · ${feed.duplicateEvents} duplicate events`],
      ]
    : [];

  return (
    <section className="ls-card" aria-labelledby="facility-quality-title" data-testid="facility-data-quality">
      <header className="ls-card-header">
        <div>
          <h3 id="facility-quality-title" className="ls-card-title">{facility.name}: data quality</h3>
          {/* The source is secondary here: Live Surveillance is its home. */}
          <p className="mt-0.5 text-[11px] text-muted">{facility.environmentLabel}</p>
        </div>
        <ReportingStatus feed={feed} />
      </header>
      {feed?.isReporting ? (
        <dl className="divide-y divide-hairline px-5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status" className="px-5 py-4 text-sm leading-relaxed text-ink">
          <span className="font-semibold">No data currently available</span> from {facility.name}. Its situation is{' '}
          <span className="font-semibold">unknown</span> — a silent feed does not mean no abnormal activity.
        </p>
      )}
      {liveFeedsPath ? (
        <p className="border-t border-hairline px-5 py-3 text-xs">
          <Link to={liveFeedsPath} className="font-semibold text-brand hover:underline">
            Live feed operations on the Dashboard <span aria-hidden="true">→</span>
          </Link>
        </p>
      ) : null}
    </section>
  );
}
