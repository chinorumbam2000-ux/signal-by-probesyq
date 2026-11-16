/**
 * Roella — the two modes, and why their dates differ.
 *
 * Live Surveillance is the primary experience; Scenario Replay is the
 * secondary, training mode. They are separate synthetic scenarios, each with
 * its own dates: nothing here suggests the data is inconsistent, and nothing
 * is calculated — these answers only explain the modes.
 */
import { formatSimulationDate } from '../lib/format';
import type { AnswerBlock, AssistantAnswer, AssistantContext, IntentId } from './types';

type ModeIntent = Extract<IntentId, 'mode_main' | 'mode_replay' | 'mode_dates' | 'mode_start' | 'live_test_tools' | 'live_pipeline'>;

const text = (value: string): AnswerBlock => ({ kind: 'text', text: value });
const answer = (intent: IntentId, blocks: AnswerBlock[], followUps: string[]): AssistantAnswer => ({
  intent,
  blocks,
  followUps: followUps.slice(0, 3),
});

const START_VERB = /\b(start|begin|launch|turn on|switch on|kick off)\b/;
const LIVE_THING = /\b(live|feeds?)\b/;
const ASKING_HOW = /^(how|where|what|can i|can you|could i|i want to|i need to|help me|tell me how|show me how)\b/;

/** Which mode question this is, if any (normalized text). */
export const parseModeIntent = (t: string): ModeIntent | null => {
  const has = (...needles: string[]) => needles.some((n) => t.includes(n));
  // Where the test tools are, and how an observation becomes a signal: both under System.
  // Whole words: "latest observation" is not a test observation.
  if (/\b(test tools?|inject\w*|test observations?|synthetic test)\b/.test(t)) return 'live_test_tools';
  if (
    has('how this works', 'how does live surveillance work', 'how live surveillance works', 'observation to signal', 'observations become') ||
    (has('process', 'handle', 'turn') && has('observation', 'result', 'message') && !has('fhir', 'ingest') && /^(how|where|what)\b/.test(t))
  ) {
    return 'live_pipeline';
  }
  if ((ASKING_HOW.test(t) && START_VERB.test(t) && LIVE_THING.test(t)) || has('start button', 'start control')) {
    return 'mode_start';
  }
  // The playback speed lives with the other Live Surveillance controls.
  if (ASKING_HOW.test(t) && /\b(speed|faster|slower)\b/.test(t)) return 'mode_start';
  if (
    has('dates different', 'different dates', 'dates differ', 'date different', 'different date', 'dates dont match', 'dates do not match',
      'dates not match', 'dates are not the same', 'not the same date', 'same dates', 'same date', 'dates dont line up', 'dates inconsistent',
      'inconsistent dates', 'date mismatch', 'dates mismatch')
  ) {
    return 'mode_dates';
  }
  if (
    has('main mode', 'primary mode', 'default mode', 'which mode', 'what mode', 'what modes', 'which modes', 'two modes', 'both modes',
      'modes are there', 'live or replay', 'replay or live', 'live vs', 'replay vs', 'live versus', 'replay versus',
      'difference between live', 'difference between replay', 'difference between scenario replay', 'difference between the modes')
  ) {
    return 'mode_main';
  }
  if (
    /^(what is|whats|what s|explain|describe|tell me about) (the )?scenario replay( mode)?( for)?$/.test(t) ||
    /^what is (the )?replay mode( for)?$/.test(t) ||
    has('purpose of scenario replay', 'purpose of the replay', 'why use scenario replay', 'what is scenario replay for', 'what is the scenario replay for')
  ) {
    return 'mode_replay';
  }
  return null;
};

const PRIMARY =
  'Live Surveillance is the main mode, and where a new session opens: synthetic observations arrive through three simulated source feeds (FHIR R4, HL7 v2 and LIS/API), and every surveillance profile’s score is recalculated as they do.';
const SECONDARY =
  'Scenario Replay is the secondary mode: a controlled historical training scenario that steps through a known five-day outbreak progression, for training, walkthroughs and review.';

const mainMode = (ctx: AssistantContext): AssistantAnswer =>
  answer('mode_main', [
    text(PRIMARY),
    text(SECONDARY),
    text(
      ctx.live
        ? 'You are in Live Surveillance now.'
        : 'You are in Scenario Replay now. Choose Live Surveillance with the Dashboard’s context selector to return to the current simulated feed.',
    ),
  ], ['What is Scenario Replay?', 'Why are the dates different?']);

const replayMode = (ctx: AssistantContext, replayDate: string): AssistantAnswer =>
  answer('mode_replay', [
    text(
      'Scenario Replay is a controlled historical training scenario. It replays a known Respiratory Viral Activity outbreak progression over five fixed days, so you can review how the signal developed, one day at a time, from the baseline onward.',
    ),
    text('It is used for training, walkthroughs and controlled review. It is not the current operational state: Live Surveillance is the primary mode.'),
    text(
      ctx.live
        ? 'You are in Live Surveillance now; choose Scenario Replay with the Dashboard’s context selector to open it.'
        : `It is on Replay Day ${ctx.day} of 5 (replay date ${replayDate}).`,
    ),
  ], ctx.live ? ['What is the main mode?', 'Why are the dates different?'] : ['Why are the dates different?', 'What is the main mode?']);

const datesDiffer = (ctx: AssistantContext, replayDate: string): AssistantAnswer =>
  answer('mode_dates', [
    text('Live Surveillance and Scenario Replay are separate synthetic scenarios, so their dates are intentionally independent.'),
    text(
      `Live Surveillance uses its own simulated feed timeline: seven days of synthetic history, then live days that stream on a simulated clock${
        ctx.live ? ` (the live surveillance date is now ${ctx.live.clock}, simulated)` : ''
      }.`,
    ),
    text(
      `Scenario Replay preserves the original five-day historical training sequence, with its own replay dates${
        ctx.live ? '' : ` (Replay Day ${ctx.day} is ${replayDate})`
      }.`,
    ),
    text('The data is not inconsistent: each mode keeps its own calendar, and nothing in one mode changes the other.'),
  ], ['What is the main mode?', 'What is Scenario Replay?']);

/** How to start Live Surveillance: one control, on one page. */
const startLive = (ctx: AssistantContext): AssistantAnswer => {
  const live = ctx.live;
  const now = !live
    ? 'You are in Scenario Replay now: choosing Live Surveillance with the Dashboard’s context selector opens it, ready to start — it does not start on its own.'
    : live.finished
      ? 'The live period is complete. Reset on the same page starts it again from the beginning.'
      : live.playing
        ? 'It is running now.'
        : live.started
          ? 'It is paused now: Resume, in the same place, continues it.'
          : 'It has not started yet.';
  return answer('mode_start', [
    text(
      'On the Dashboard — Live Surveillance is its default context — press Start Live Surveillance in the Live Surveillance controls at the top, beside the context selector. That one button starts the simulated source feeds.',
    ),
    text(
      'The same controls then Pause, Resume and Reset the simulation, and the Speed selector (Speed: 1×) sets its speed to 1×, 2× or 4×. They are the only ones: the rest of the app shows the live data but never starts or stops it.',
    ),
    text(now),
  ], live ? ['Are all sources active?', 'Is this real-time?'] : ['What is the main mode?', 'What is Scenario Replay?']);
};

/** The test tools: under System → Integration Demo, never on the Dashboard. */
const testTools = (): AssistantAnswer =>
  answer('live_test_tools', [
    text(
      'The test tools are under System → Integration Demo, in Test tools: inject a synthetic test observation. Choose a facility, a test and a result, then Send test observation.',
    ),
    text(
      'The observation is synthetic, not a patient result: it goes into Live Surveillance in its facility’s own source format and is processed like any other, so scores change only through the data. Its effect shows on the Dashboard.',
    ),
  ], ['How does Signal process observations?', 'Are all sources active?']);

/** How an observation becomes a signal: under System → Architecture (and Detection Methods for EWMA and CUSUM). */
const pipeline = (): AssistantAnswer =>
  answer('live_pipeline', [
    text('In Live Surveillance, each synthetic observation goes: Observation → Normalization → Profile routing → Surveillance calculation → Signal update.'),
    text(
      'It arrives in its facility’s source format (FHIR R4, HL7 v2 or LIS/API), is normalized to a LOINC-coded result, routed to its surveillance profiles, and each profile’s score is recalculated. Each day closes at 19:30 and becomes the current signal.',
    ),
    text('System → Architecture explains it under How Live Surveillance works; System → Detection Methods covers EWMA and CUSUM in the full-stack build.'),
  ], ['Where are the test tools?', 'Is this real-time?']);

export const answerModeIntent = (intent: IntentId, ctx: AssistantContext, replaySimulationDate: string): AssistantAnswer | null => {
  if (intent === 'live_test_tools') return testTools();
  if (intent === 'live_pipeline') return pipeline();
  const replayDate = formatSimulationDate(replaySimulationDate);
  if (intent === 'mode_main') return mainMode(ctx);
  if (intent === 'mode_replay') return replayMode(ctx, replayDate);
  if (intent === 'mode_dates') return datesDiffer(ctx, replayDate);
  if (intent === 'mode_start') return startLive(ctx);
  return null;
};
