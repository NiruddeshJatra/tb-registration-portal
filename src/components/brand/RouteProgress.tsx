// Route-progress line — segment boundaries proportional to the real race
// distances (RUN 10K / BIKE 40K / RUN 5K + finish gantry). Replaces StepProgress.
// `legs` labels the three segments; events without the duathlon's legs (a
// virtual run) pass their own. The geometry stays fixed either way.
interface Props {
  step: number // 1..4
  legs?: [string, string, string]
}

const DUATHLON_LEGS: [string, string, string] = ['RUN 10K', 'BIKE 40K', 'RUN 5K']

const STEP_TITLES: Record<number, string> = {
  1: 'Segment 01 — Eligibility',
  2: 'Segment 02 — Personal',
  3: 'Segment 03 — Payment',
  4: 'Finish — Review',
}
// route geometry: segment boundaries at x = 2, 118, 290, 386 (finish), 398
const PROGRESS_X: Record<number, number> = { 1: 118, 2: 290, 3: 386, 4: 398 }

export function RouteProgress({ step, legs = DUATHLON_LEGS }: Props) {
  const progressX = PROGRESS_X[step] ?? 118
  // Start Line is a light-only surface — hardcode the palette so the SVG
  // renders identically everywhere (no reliance on var() in fill/stroke attrs).
  const ink = '#15180E'
  const paper = '#F1EFE6'
  const cha = '#C6F53F'
  const done = ink
  const todo = 'rgba(21,24,14,.4)'
  const trackTransition = { transition: 'all .45s cubic-bezier(.65,0,.35,1)' } as const

  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="font-heading text-xs font-semibold tracking-[0.26em] text-foreground uppercase">
          {STEP_TITLES[step]}
        </p>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">Step {step}/4</p>
      </div>
      <svg viewBox="-8 0 416 36" className="block w-full" aria-hidden="true">
        <line x1="2" y1="12" x2="398" y2="12" stroke="rgba(21,24,14,.22)" strokeWidth="3" strokeLinecap="round" />
        <line x1="2" y1="12" x2={progressX} y2="12" stroke={ink} strokeWidth="3" strokeLinecap="round" style={trackTransition} />
        <circle cx="2" cy="12" r="4" fill={cha} stroke={ink} strokeWidth="1.5" />
        <circle cx="118" cy="12" r="4" fill={step >= 2 ? cha : paper} stroke={ink} strokeWidth="1.5" />
        <circle cx="290" cy="12" r="4" fill={step >= 3 ? cha : paper} stroke={ink} strokeWidth="1.5" />
        <g transform="translate(383, 3)">
          <rect x="0" y="0" width="3" height="18" fill={ink} />
          <rect x="3" y="0" width="12" height="9" fill={step >= 4 ? cha : paper} stroke={ink} strokeWidth="0.5" />
        </g>
        <circle cx={progressX} cy="12" r="5.5" fill={cha} stroke={ink} strokeWidth="2" style={{ ...trackTransition, animation: 'sl-pulse 1.6s ease-in-out infinite' }} />
        <text x="2" y="31" fontFamily="Oswald" fontSize="8.5" letterSpacing="1.5" fill={done}>{legs[0]}</text>
        <text x="118" y="31" fontFamily="Oswald" fontSize="8.5" letterSpacing="1.5" fill={step >= 2 ? done : todo}>{legs[1]}</text>
        <text x="290" y="31" fontFamily="Oswald" fontSize="8.5" letterSpacing="1.5" fill={step >= 3 ? done : todo}>{legs[2]}</text>
        <text x="398" y="31" fontFamily="Oswald" fontSize="8.5" letterSpacing="1.5" fill={step >= 4 ? done : todo} textAnchor="end">FINISH</text>
      </svg>
    </div>
  )
}
