import { useEffect, useState } from "react"

interface Props {
  value: number
  durationMs?: number
  format?: (n: number) => string
}

// Animates a number counting up to `value` on mount/change; renders the final
// value immediately under prefers-reduced-motion.
export function CountUp({ value, durationMs = 900, format }: Props) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setDisplay(value)
      return
    }
    let raf = 0
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <span className="tabular-nums">{format ? format(display) : display}</span>
}
