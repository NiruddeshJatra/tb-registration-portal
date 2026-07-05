export function GoldRing({ children }: { children: React.ReactNode }) {
  const r = 90
  const circumference = 2 * Math.PI * r

  return (
    <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="gold-ring-draw motion-reduce:[stroke-dashoffset:0]"
          style={{ strokeDashoffset: circumference }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
}
