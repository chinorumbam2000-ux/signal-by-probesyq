/**
 * Mode-aware wording: the one place that says how Scenario Replay and Live
 * Surveillance name their days, their data and their time-dependent rules.
 *
 * Scenario Replay numbers its five fixed days ("Day 4"). Live Surveillance
 * names its simulated calendar days ("Feb 12") and closes a day at 19:30.
 * Components ask for a phrase here instead of writing "replay day" into text
 * that both modes show. Presentation only: no data or calculation changes.
 */
import { useOptionalLiveSurveillance, type SurveillanceMode } from '../context/LiveSurveillanceContext';
import { liveDayLabel } from './live/view';
import { PROFILE_BY_ID, RVS_PROFILE_ID, type DataOrigin } from './profiles/registry';

export interface ModeWording {
  mode: SurveillanceMode;
  /** A day's name: "Day 12" (Scenario Replay) or "Feb 12" (Live Surveillance). */
  day: (day: number) => string;
  /** The small day tag beside a detection timestamp — Replay only; Live's timestamp already carries the date. */
  dayTag: (day: number) => string | null;
  /** Where a profile's figures come from, in a few words. */
  dataOrigin: (origin: DataOrigin) => string;
  /** Where a profile's figures come from, in a sentence. */
  originNote: (origin: DataOrigin) => string;
  /** Ends "…, detected on ___": "replay day 12" or "Feb 12". */
  detectedOn: (day: number) => string;
  /** Detection-time values "___": they stay as recorded while time moves on. */
  frozenValues: string;
  /** Subtitle for the current (not detection-time) figures. */
  currentFigures: string;
  /** Why later values are not shown in a trend table. */
  withheld: string;
  /** Screen-reader caption for a two-day comparison table. */
  comparison: (previous: number, current: number) => string;
  /** The range a per-facility trend chart covers. */
  trendRange: (current: number) => string;
  /** Shown when there is no earlier day to compare with. */
  noPreviousDay: string;
  /** Title of an empty alert table. */
  noAlerts: string;
}

const RVA = PROFILE_BY_ID[RVS_PROFILE_ID].displayName;

const REPLAY: ModeWording = {
  mode: 'replay',
  day: (day) => `Day ${day}`,
  dayTag: (day) => `Day ${day}`,
  dataOrigin: (origin) =>
    origin === 'replay-scenario'
      ? 'Scenario Replay data'
      : origin === 'replay-derived'
        ? 'Derived from the replay results'
        : 'Synthetic portfolio data',
  originNote: (origin) =>
    origin === 'replay-scenario'
      ? 'The narrated five-day Scenario Replay.'
      : origin === 'replay-derived'
        ? `Built from the same replay results as ${RVA}, filtered to this profile’s tests. Its daily counts are smaller, so its score moves more from day to day.`
        : 'Synthetic portfolio data with demonstration test codes (not LOINC). Not part of the narrated replay.',
  detectedOn: (day) => `replay day ${day}`,
  frozenValues: 'do not change as the replay advances',
  currentFigures: 'Values for the selected replay day',
  withheld: 'Values beyond the current replay day are withheld until the day is reached.',
  comparison: (previous, current) => `Comparison of replay day ${previous} with day ${current}`,
  trendRange: () => 'Day 1 → current',
  noPreviousDay: 'Day 1 establishes the baseline that later days are compared against.',
  noAlerts: 'No alerts on this replay day',
};

const LIVE: ModeWording = {
  mode: 'live',
  day: liveDayLabel,
  dayTag: () => null,
  dataOrigin: (origin) => (origin === 'portfolio-fixture' ? 'Not in the live source feeds' : 'Live Surveillance data'),
  originNote: (origin) =>
    origin === 'portfolio-fixture'
      ? 'Not part of the simulated live source feeds; its synthetic portfolio data is shown in Scenario Replay.'
      : 'Scored from the observations the live source feeds route to this profile, for each closed day.',
  detectedOn: (day) => liveDayLabel(day),
  frozenValues: 'do not change as later live days close',
  currentFigures: 'Values for the latest closed day',
  withheld: 'Closed days only: the open day is provisional and joins the trend when it closes at 19:30.',
  comparison: (previous, current) => `Comparison of ${liveDayLabel(previous)} with ${liveDayLabel(current)}`,
  trendRange: (current) => `Through ${liveDayLabel(current)}`,
  noPreviousDay: 'The first closed day establishes the baseline that later days are compared against.',
  noAlerts: 'No alerts through the latest closed day',
};

export const modeWording = (mode: SurveillanceMode): ModeWording => (mode === 'live' ? LIVE : REPLAY);

/** The wording for the mode the analyst is in (Scenario Replay outside the live provider). */
export function useModeWording(): ModeWording {
  return modeWording(useOptionalLiveSurveillance()?.mode ?? 'replay');
}
