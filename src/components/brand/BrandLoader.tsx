interface Props {
  label?: string
  inline?: boolean
  size?: number
  className?: string
}

// Dual-ring brand spinner: outer ring green, inner counter-rotating arc gold.
// Falls back to a static shield mark + text under prefers-reduced-motion.
export function BrandLoader({ label = "লোড হচ্ছে…", inline = false, size = inline ? 16 : 40, className }: Props) {
  return (
    <div className={`${inline ? "inline-flex items-center gap-2" : "flex flex-col items-center justify-center gap-3 py-10"} ${className ?? ""}`}>
      <span className="relative motion-reduce:hidden" style={{ width: size, height: size }} aria-hidden="true">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--bright-green)] border-r-[var(--bright-green)]" />
        <span className="absolute inset-[18%] animate-spin-reverse rounded-full border-2 border-transparent border-b-[var(--gold)] border-l-[var(--gold)]" />
      </span>
      <img
        src="/assets/triathlon-bd-shield-white.png"
        alt=""
        className="hidden motion-reduce:block"
        style={{ height: inline ? size : size * 0.8, width: "auto" }}
      />
      {!inline && <p className="text-sm text-muted-foreground">{label}</p>}
      {inline && label && <span className="sr-only">{label}</span>}
    </div>
  )
}
