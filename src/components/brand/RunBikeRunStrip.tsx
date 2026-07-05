// Simple hand-drawn discipline strip for the duathlon: run -> bike -> run.
export function RunBikeRunStrip() {
  return (
    <svg
      viewBox="0 0 200 32"
      className="mx-auto h-6 w-auto"
      role="img"
      aria-label="10K run, 40K bike, 5K run"
    >
      <line x1="20" y1="16" x2="180" y2="16" stroke="var(--border)" strokeWidth="2" strokeDasharray="3 4" />
      {/* runner 1 */}
      <g stroke="var(--bright-green)" strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="16" cy="6" r="3" fill="var(--bright-green)" stroke="none" />
        <path d="M16 10 L14 18 L8 22 M16 10 L20 16 L26 14 M14 18 L20 24" />
      </g>
      {/* bike */}
      <g stroke="var(--ride-red)" strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="92" cy="22" r="6" />
        <circle cx="112" cy="22" r="6" />
        <path d="M92 22 L100 8 L112 22 M100 8 L104 8 M92 22 L106 22" />
      </g>
      {/* runner 2 */}
      <g stroke="var(--bright-green)" strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="184" cy="6" r="3" fill="var(--bright-green)" stroke="none" />
        <path d="M184 10 L182 18 L176 22 M184 10 L188 16 L194 14 M182 18 L188 24" />
      </g>
    </svg>
  )
}
