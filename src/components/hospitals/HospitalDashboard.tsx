import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HospitalMetrics, PrivacyResult } from '../../types';
import { useModeWording } from '../../lib/modeWording';

const VOLUME_COLOR = '#2563EB';
const POSITIVITY_COLOR = '#DC2626';
const AXIS_COLOR = '#64748B';
const GRID_COLOR = '#DCE6F1';

/** How the facility's positive counts may be shown (the small-count rule, applied at Facility level). */
export interface FacilityCountPrivacy {
  /** The facility's positives on a given day. */
  on: (day: number) => PrivacyResult;
}

interface HospitalDashboardProps {
  metrics: HospitalMetrics;
  currentDay: number;
  privacy: FacilityCountPrivacy;
  /** How a day is named: "Day 5" (Scenario Replay) or "Feb 12" (Live Surveillance). */
  label?: (day: number) => string;
}

const axisProps = {
  tick: { fill: AXIS_COLOR, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID_COLOR },
};

const tooltipStyles = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #DCE6F1',
    fontSize: 12,
    boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.10)',
  },
  labelStyle: { color: '#0F172A', fontWeight: 600 },
};

/**
 * One facility's activity for the selected profile: its tests, positivity and
 * first signal, and two compact trends (volume and positivity). Individual
 * laboratory records are on Laboratory Data, and the facility's data quality
 * is in its own section, so neither is repeated here.
 */
export default function HospitalDashboard({
  metrics,
  currentDay,
  privacy,
  label = (day: number) => `Day ${day}`,
}: HospitalDashboardProps) {
  const today = privacy.on(currentDay);
  const stats = [
    {
      label: `Tests — ${label(currentDay)}`,
      value: metrics.totalTests.toLocaleString('en-US'),
      note: `${metrics.cumulativeTests.toLocaleString('en-US')} cumulative through ${label(currentDay)}`,
    },
    {
      label: `Positivity — ${label(currentDay)}`,
      // A rate beside its test count would reveal a withheld count, so both follow the rule.
      value: today.suppressed ? today.displayValue : `${metrics.positivityRate.toFixed(1)}%`,
      note: today.suppressed
        ? `Fewer than 5 of ${metrics.totalTests} tests positive — withheld`
        : `${today.displayValue} of ${metrics.totalTests} tests positive`,
    },
    {
      // Never reveals a day the simulation has not reached yet.
      label: 'First Signal',
      value: metrics.firstSignalDay ? label(metrics.firstSignalDay) : 'Not yet detected',
      note: metrics.firstSignalDay
        ? metrics.isAffected
          ? 'Currently contributing'
          : 'Not contributing on this day'
        : 'No signal through the current day',
    },
  ];

  const volumeData = metrics.volumeSeries.map((point) => ({
    ...point,
    dayLabel: label(point.day),
  }));
  // Days whose positive count is withheld are not plotted (a gap, never a value).
  const positivityData = metrics.positivitySeries.map((point) => ({
    ...point,
    positivity: privacy.on(point.day).suppressed ? null : point.positivity,
    dayLabel: label(point.day),
  }));
  const wording = useModeWording();
  const withheldDays = metrics.positivitySeries.filter((point) => privacy.on(point.day).suppressed).map((p) => p.day);
  // The charts in words, for screen readers (withheld days stay withheld).
  const volumeSummary = `Tests by day: ${volumeData.map((p) => `${p.dayLabel} ${p.tests}`).join(', ')}.`;
  const positivitySummary = `Positivity by day: ${positivityData
    .map((p) => `${p.dayLabel} ${p.positivity === null ? 'withheld (fewer than 5 positives)' : `${p.positivity}%`}`)
    .join(', ')}.`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="ls-card p-4">
            <p className="ls-label">{stat.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-ink">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] text-muted">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="ls-card">
          <header className="ls-card-header">
            <h3 className="ls-card-title">Test Volume</h3>
            <span className="ls-label">{wording.trendRange(currentDay)}</span>
          </header>
          <p className="sr-only">{volumeSummary}</p>
          <div className="h-[180px] p-4" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayLabel" {...axisProps} />
                <YAxis {...axisProps} axisLine={false} width={40} />
                <Tooltip {...tooltipStyles} formatter={(value: number) => [value, 'Tests']} />
                <Bar
                  dataKey="tests"
                  fill={VOLUME_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="ls-card">
          <header className="ls-card-header">
            <h3 className="ls-card-title">Positivity Rate</h3>
            <span className="ls-label">{wording.trendRange(currentDay)}</span>
          </header>
          <p className="sr-only">{positivitySummary}</p>
          <div className="h-[180px] p-4" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={positivityData}
                margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
              >
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayLabel" {...axisProps} />
                <YAxis
                  {...axisProps}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  {...tooltipStyles}
                  formatter={(value: unknown) => [value === null || value === undefined ? '<5 (withheld)' : `${String(value)}%`, 'Positivity']}
                />
                <Line
                  type="monotone"
                  dataKey="positivity"
                  stroke={POSITIVITY_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: POSITIVITY_COLOR, stroke: '#FFFFFF', strokeWidth: 2 }}
                  activeDot={{ r: 5.5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {withheldDays.length ? (
            <p className="px-4 pb-3 text-[11px] text-muted">
              Not plotted: {withheldDays.map(label).join(', ')} — fewer than 5 positive results, withheld under the
              small-count rule.
            </p>
          ) : null}
        </section>
      </div>

    </div>
  );
}
