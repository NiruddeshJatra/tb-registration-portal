import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface TapOption {
  value: string
  label: string
}

interface Props {
  label: string
  gloss?: string // Bengali gloss shown inline in the label
  options: TapOption[]
  value: string
  onChange: (value: string) => void
  /** tailwind grid-cols class for the tile grid */
  gridClassName?: string
  /** font for the tile text — 'oswald' (default) or 'mono' */
  tileFont?: 'oswald' | 'mono'
  name: string
}

// Roving-tabindex radiogroup rendered as real <button> tap-tiles.
// Replaces <Select>/<RadioGroup> for ≤8 options on the public wizard.
export function TapTileGroup({ label, gloss, options, value, onChange, gridClassName, tileFont = 'oswald', name }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const idx = options.findIndex((o) => o.value === value)
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const start = idx < 0 ? 0 : idx
    const next = forward ? (start + 1) % options.length : (start - 1 + options.length) % options.length
    onChange(options[next].value)
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
    btns?.[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-2.5">
      {label && (
        <span className="sl-label" id={`${name}-label`}>
          {label}
          {gloss && <span className="ml-1 font-sans text-[11px] font-normal tracking-normal text-muted-foreground normal-case" lang="bn">/ {gloss}</span>}
        </span>
      )}
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label ? undefined : name.replace(/_/g, ' ')}
        aria-labelledby={label ? `${name}-label` : undefined}
        onKeyDown={onKeyDown}
        className={cn('grid gap-2.5', gridClassName ?? 'grid-cols-2')}
      >
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-pressed={selected}
              tabIndex={selected || (!value && opt === options[0]) ? 0 : -1}
              onClick={() => onChange(opt.value)}
              className={cn(
                'sl-tile min-h-11 px-2',
                tileFont === 'mono'
                  ? 'font-mono text-[13px] font-semibold'
                  : 'font-heading text-[14px] font-semibold tracking-[0.1em] uppercase',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
