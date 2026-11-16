import { fireEvent, screen } from '@testing-library/react';

/** Chooses a Live Surveillance playback speed with the Dashboard's Speed selector ("Speed: 1×" → 1×, 2× or 4×). */
export function chooseSpeed(speed: 1 | 2 | 4) {
  fireEvent.click(screen.getByRole('button', { name: /^Speed: [124]×$/ }));
  fireEvent.click(screen.getByRole('button', { name: `${speed}×` }));
}
