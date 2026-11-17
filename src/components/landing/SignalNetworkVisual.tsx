/**
 * The landing page's hero illustration: an abstract surveillance network.
 *
 * Laboratory nodes on the left send observations along data paths into an
 * interoperability hub (HL7, FHIR, LOINC), which feeds an analytics panel (a
 * signal score crossing its threshold) and a geographic view where one region
 * raises an early-warning signal. Nothing here names or depicts a real
 * facility, and the caption beside it says the public version is synthetic.
 *
 * Decorative: the page states everything it shows in text, so the whole
 * drawing is hidden from assistive technology. The flowing paths and the
 * alert's pulse are CSS animations (.ls-landing-flow, .ls-landing-pulse) that
 * stop under prefers-reduced-motion: index.css turns them off, and the drawing
 * also leaves the animation classes out while that preference is set.
 */
import { useEffect, useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether the visitor prefers reduced motion, following changes while the page is open. */
function usePrefersReducedMotion(): boolean {
  const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null);
  const [reduced, setReduced] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const list = query();
    if (!list?.addEventListener) return undefined;
    const update = () => setReduced(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return reduced;
}

const LABS = [86, 160, 234, 308];
const HUB = { x: 214, y: 197 };

/** A laboratory node: a small tile with a flask. */
function LabNode({ y, index }: { y: number; index: number }) {
  return (
    <g transform={`translate(40 ${y - 18})`}>
      <rect width="48" height="36" rx="9" fill="#163E66" stroke="#8FB6D9" strokeOpacity="0.45" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(14 7)">
        <path d="M6 1h8M7 1v6l-5 9.5a1.5 1.5 0 0 0 1.3 2.2h13.4a1.5 1.5 0 0 0 1.3-2.2L13 7V1" />
        <path d="M4.5 13h11" stroke="#4DB6A5" />
      </g>
      <text x="24" y="50" textAnchor="middle" fontSize="9" fill="#8FB6D9" fontFamily="inherit" letterSpacing="0.06em">
        {`LAB ${String.fromCharCode(65 + index)}`}
      </text>
    </g>
  );
}

/** A data path, drawn as a faint rail with a flowing dash on top. */
function DataPath({ d, delay = 0, accent = '#4DB6A5', still }: { d: string; delay?: number; accent?: string; still: boolean }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="#8FB6D9" strokeOpacity="0.28" strokeWidth="1.6" />
      <path
        d={d}
        stroke={accent}
        strokeWidth="2"
        strokeDasharray="3 11"
        className={still ? undefined : 'ls-landing-flow'}
        style={still ? undefined : { animationDelay: `${delay}s` }}
      />
    </g>
  );
}

/** A small standards tag beside the hub. */
function Tag({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 6.2 + 14;
  return (
    <g transform={`translate(${x - w / 2} ${y})`}>
      <rect width={w} height="18" rx="9" fill="#0B1F33" stroke="#8FB6D9" strokeOpacity="0.5" />
      <text x={w / 2} y="12.5" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#DCE6F1" fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}

export default function SignalNetworkVisual({ className = '' }: { className?: string }) {
  const still = usePrefersReducedMotion();
  // Signal score over time: flat, then rising through the threshold.
  const score = [
    [326, 172], [346, 168], [366, 170], [386, 164], [406, 160], [426, 146], [446, 126], [466, 104], [486, 88], [502, 78],
  ];
  const line = score.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const area = `${line} L502 182 L326 182 Z`;

  return (
    <svg
      viewBox="0 0 560 420"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-testid="landing-visual"
    >
      <defs>
        <linearGradient id="lsl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B1F33" />
          <stop offset="1" stopColor="#163E66" />
        </linearGradient>
        <pattern id="lsl-dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="#8FB6D9" opacity="0.14" />
        </pattern>
        <linearGradient id="lsl-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4DB6A5" stopOpacity="0.35" />
          <stop offset="1" stopColor="#4DB6A5" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lsl-hub" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2563EB" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="560" height="420" rx="22" fill="url(#lsl-bg)" />
      <rect width="560" height="420" rx="22" fill="url(#lsl-dots)" />

      {/* Stage labels. */}
      <g fontSize="9" fontWeight="600" letterSpacing="0.12em" fill="#8FB6D9" fontFamily="inherit">
        <text x="40" y="44">LABORATORIES</text>
        <text x={HUB.x} y="44" textAnchor="middle">INTEROPERABILITY</text>
        <text x="314" y="44">ANALYTICS</text>
        <text x="314" y="236">GEOGRAPHY</text>
      </g>

      {/* Laboratories → hub. */}
      {LABS.map((y, i) => (
        <DataPath key={y} d={`M88 ${y} C 140 ${y}, 150 ${HUB.y}, ${HUB.x - 30} ${HUB.y}`} delay={-i * 0.45} still={still} />
      ))}
      {/* Hub → analytics, hub → geography. */}
      <DataPath d={`M${HUB.x + 30} ${HUB.y} C 270 ${HUB.y}, 272 128, 300 128`} delay={-0.8} accent="#8FB6D9" still={still} />
      <DataPath d={`M${HUB.x + 30} ${HUB.y} C 270 ${HUB.y}, 272 318, 300 318`} delay={-1.6} accent="#8FB6D9" still={still} />

      {LABS.map((y, i) => (
        <LabNode key={y} y={y} index={i} />
      ))}

      {/* Interoperability hub. */}
      <circle cx={HUB.x} cy={HUB.y} r="58" fill="url(#lsl-hub)" />
      <circle cx={HUB.x} cy={HUB.y} r="30" fill="#163E66" stroke="#8FB6D9" strokeOpacity="0.6" strokeWidth="1.4" />
      <circle cx={HUB.x} cy={HUB.y} r="21" fill="#2563EB" />
      <text x={HUB.x} y={HUB.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF" fontFamily="inherit">
        FHIR
      </text>
      <Tag x={HUB.x} y={HUB.y - 62} label="HL7 v2" />
      <Tag x={HUB.x} y={HUB.y + 44} label="LOINC" />

      {/* Analytics: a signal score crossing its threshold. */}
      <g>
        <rect x="300" y="58" width="226" height="140" rx="14" fill="#FFFFFF" fillOpacity="0.05" stroke="#FFFFFF" strokeOpacity="0.16" />
        <text x="316" y="80" fontSize="10" fontWeight="600" fill="#DCE6F1" fontFamily="inherit">Signal score</text>
        <g fill="#8FB6D9" opacity="0.22">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <rect key={i} x={330 + i * 20} y={182 - (8 + i * 2.2)} width="9" height={8 + i * 2.2} rx="2" />
          ))}
        </g>
        <path d="M316 120 H510" stroke="#F59E0B" strokeOpacity="0.85" strokeWidth="1.2" strokeDasharray="4 4" />
        <text x="510" y="114" textAnchor="end" fontSize="8.5" fill="#FCD34D" fontFamily="inherit">threshold</text>
        <path d={area} fill="url(#lsl-area)" />
        <path d={line} fill="none" stroke="#4DB6A5" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="502" cy="78" r="4.5" fill="#F59E0B" stroke="#0B1F33" strokeWidth="1.5" />
      </g>

      {/* Geography: abstract regions, one raising an early-warning signal. */}
      <g>
        <rect x="300" y="246" width="226" height="148" rx="14" fill="#FFFFFF" fillOpacity="0.05" stroke="#FFFFFF" strokeOpacity="0.16" />
        <g fill="#FFFFFF" fillOpacity="0.04" stroke="#8FB6D9" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round">
          <path d="M320 268 L372 262 L384 300 L350 318 L318 304 Z" />
          <path d="M372 262 L430 258 L438 292 L384 300 Z" />
          <path d="M430 258 L506 264 L510 300 L438 292 Z" />
          <path d="M318 304 L350 318 L356 372 L322 376 Z" />
          <path d="M350 318 L384 300 L438 292 L446 340 L400 378 L356 372 Z" fill="#F59E0B" fillOpacity="0.14" stroke="#F59E0B" strokeOpacity="0.6" />
          <path d="M438 292 L510 300 L508 374 L446 340 Z" />
          <path d="M400 378 L446 340 L508 374 L470 380 Z" />
        </g>
        <g fill="#4DB6A5">
          <circle cx="345" cy="286" r="3" />
          <circle cx="408" cy="278" r="3" />
          <circle cx="472" cy="282" r="3" />
          <circle cx="336" cy="345" r="3" />
          <circle cx="478" cy="330" r="3" />
        </g>
        {/* The early-warning signal: rings pulse outward from the point (one still ring under reduced motion). */}
        {still ? (
          <circle cx="398" cy="336" r="16" fill="none" stroke="#F97316" strokeWidth="1.6" strokeOpacity="0.55" />
        ) : (
          <>
            <circle cx="398" cy="336" r="16" fill="none" stroke="#F97316" strokeWidth="1.6" className="ls-landing-pulse" />
            <circle cx="398" cy="336" r="16" fill="none" stroke="#F97316" strokeWidth="1.6" className="ls-landing-pulse" style={{ animationDelay: '1.3s' }} />
          </>
        )}
        <circle cx="398" cy="336" r="9" fill="#F97316" fillOpacity="0.25" />
        <circle cx="398" cy="336" r="4.5" fill="#F97316" stroke="#FFFFFF" strokeWidth="1.4" />
        <g transform="translate(412 352)">
          <rect width="98" height="20" rx="10" fill="#0B1F33" stroke="#F97316" strokeOpacity="0.7" />
          <text x="49" y="13.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#FED7AA" fontFamily="inherit">Early-warning signal</text>
        </g>
      </g>
    </svg>
  );
}
