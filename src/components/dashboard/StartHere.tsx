import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveSurveillance } from '../../context/LiveSurveillanceContext';

export const START_HERE_KEY = 'labsentinel.startHere.dismissed.v1';

const readDismissed = () => {
  try {
    return window.sessionStorage.getItem(START_HERE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * One line for a first-time visitor: what the product does, and that
 * everything is synthetic. Dismissible for the browser session; changes no
 * data. It holds no action of its own: Live Surveillance is started from the
 * Dashboard's Live Surveillance strip, its one Start control.
 */
export default function StartHere() {
  const { mode, started } = useLiveSurveillance();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (dismissed || (mode === 'live' && started)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(START_HERE_KEY, '1');
    } catch {
      /* storage unavailable: dismissed for this page only */
    }
  };
  return (
    <section
      aria-label="Start here"
      className="ls-card flex flex-wrap items-center justify-between gap-3 border-brand/30 px-4 py-3"
      data-testid="start-here"
    >
      <p className="min-w-0 flex-1 text-sm text-ink">
        <span className="font-semibold">Start here.</span> Signal by ProbeSyQ turns laboratory results into
        early-warning outbreak signals for each surveillance profile. Everything is synthetic —{' '}
        <Link to="/overview#about-the-data" className="text-brand underline-offset-2 hover:underline">
          what that means
        </Link>
        .
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-canvas hover:text-ink"
          aria-label="Dismiss the introduction"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </section>
  );
}
