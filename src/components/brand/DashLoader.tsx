// Marching dashed chartreuse route line — the ONLY spinner in the new system.
// `inline` variant (for buttons) draws a short line beside the label.
interface Props {
  label?: string
  inline?: boolean
  className?: string
}

export function DashLoader({ label = 'লোড হচ্ছে…', inline = false, className }: Props) {
  if (inline) {
    return (
      <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        {label && <span lang="bn">{label}</span>}
        <svg width="40" height="10" viewBox="0 0 40 10" aria-hidden="true">
          <line x1="2" y1="5" x2="38" y2="5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="8 4" style={{ animation: 'sl-dash .5s linear infinite' }} />
        </svg>
      </span>
    )
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-5 py-10 text-foreground ${className ?? ''}`} role="status" aria-live="polite">
      <svg width="120" height="28" viewBox="0 0 120 28" aria-hidden="true">
        <line x1="4" y1="14" x2="116" y2="14" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" strokeLinecap="round" />
        <line x1="4" y1="14" x2="116" y2="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 4" style={{ animation: 'sl-dash .5s linear infinite' }} />
      </svg>
      {label && <p className="text-[13px] tracking-[0.04em] text-muted-foreground" lang="bn">{label}</p>}
    </div>
  )
}
