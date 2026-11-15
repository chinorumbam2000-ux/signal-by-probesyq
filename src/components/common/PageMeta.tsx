import { useLocation } from 'react-router-dom';
import { useSimulation } from '../../context/SimulationContext';
import { usePortfolio } from '../../lib/profiles/usePortfolio';
import { RVS_PROFILE_ID } from '../../lib/profiles/registry';
import { useOptionalLiveSurveillance } from '../../context/LiveSurveillanceContext';

/**
 * The standard page header meta block: the period the page's figures
 * represent (Live Surveillance's latest closed day, or the replay day). The
 * current date and clock are the top bar's, visible at every width, so they
 * are not repeated here; nor is the simulated-data disclosure.
 *
 * The stage ("Regional Early-Warning Signal") is the narrated replay's, so it
 * is shown on Scenario Replay and while Respiratory Viral Activity is the
 * selected profile — never beside another profile.
 */
export default function PageMeta() {
  const { currentDay, currentScenario } = useSimulation();
  const { pathname } = useLocation();
  const { focusId, period } = usePortfolio();
  const live = useOptionalLiveSurveillance();
  if (live?.mode === 'live' && period.mode === 'live') {
    return (
      <div className="text-left sm:ml-auto sm:text-right" data-testid="page-meta">
        <p className="ls-label">Live Surveillance · signals for {period.currentLabel} (latest closed day)</p>
      </div>
    );
  }
  const showStage = pathname === '/replay' || pathname === '/simulation' || focusId === RVS_PROFILE_ID;

  return (
    <div className="text-left sm:ml-auto sm:text-right" data-testid="page-meta">
      <p className="ls-label">
        Replay Day {currentDay} of 5{showStage ? ` · ${currentScenario.stage}` : ''}
      </p>
    </div>
  );
}
