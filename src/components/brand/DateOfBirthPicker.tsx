import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  value: string // ISO yyyy-mm-dd, or ''
  onChange: (iso: string) => void
  max?: string // ISO — dates after this are disabled/rejected
  onBlur?: () => void
  onFocus?: () => void
  invalid?: boolean // red border + shake
  valid?: boolean // ink border when a valid value is present
  /** compact = admin (h-10, 1px borders); default = public wizard (h-13, 1.5px) */
  compact?: boolean
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}
function displayToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const day = Number(dd), month = Number(mm), year = Number(yyyy)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export function DateOfBirthPicker({ id, value, onChange, max, onBlur, onFocus, invalid, valid, compact }: Props) {
  const [text, setText] = useState(() => isoToDisplay(value))
  const [open, setOpen] = useState(false)
  const base = value ? new Date(value) : new Date(1995, 0, 1)
  const [month, setMonth] = useState(base.getMonth())
  const [year, setYear] = useState(base.getFullYear())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setText(isoToDisplay(value)) }, [value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function handleText(raw: string) {
    setText(raw)
    const iso = displayToIso(raw)
    if (iso && (!max || iso <= max)) onChange(iso)
  }

  function toggle() {
    if (!open) {
      const b = value ? new Date(value) : new Date(1995, 0, 1)
      setMonth(b.getMonth())
      setYear(b.getFullYear())
    }
    setOpen((o) => !o)
  }

  const maxDate = max ? new Date(max) : new Date()
  const yearMax = maxDate.getFullYear()
  const years = Array.from({ length: 90 }, (_, i) => yearMax - i)

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: ({ day: number; iso: string; future: boolean } | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0'), mm = String(month + 1).padStart(2, '0')
    const iso = `${year}-${mm}-${dd}`
    cells.push({ day: d, iso, future: new Date(year, month, d) > maxDate })
  }

  const h = compact ? 'h-10' : 'h-[52px]'
  const bw = compact ? 'border' : 'border-[1.5px]'
  const borderClr = invalid ? 'border-destructive' : valid ? 'border-border-strong' : 'border-border'
  const selBtn = compact
    ? 'h-9 border border-border-strong bg-input px-2'
    : 'h-9 border-[1.5px] border-border-strong bg-input px-2.5'

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-2">
        <input
          id={id}
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          className={cn(
            'min-w-0 flex-1 rounded-none bg-input px-3.5 font-mono text-foreground tabular-nums outline-none focus-visible:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/55',
            h, bw, borderClr,
            compact ? 'text-[12.5px]' : 'text-base',
            invalid && 'animate-shake',
          )}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label="Open calendar"
          aria-expanded={open}
          className={cn('flex shrink-0 items-center justify-center rounded-none border-border-strong bg-input', h, bw, compact ? 'w-10' : 'w-[52px]', open && 'bg-accent')}
        >
          <svg width={compact ? 15 : 18} height={compact ? 15 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="1" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="animate-rise absolute inset-x-0 top-[calc(100%+6px)] z-20 border border-border-strong bg-popover p-3.5 shadow-[6px_6px_0_rgba(21,24,14,.85)] dark:shadow-[0_20px_50px_rgba(0,0,0,.5)]">
          <div className="mb-3 flex gap-2">
            <div className="relative flex-[1.4]">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={cn('w-full appearance-none rounded-none font-heading text-[12.5px] font-semibold tracking-wide text-foreground uppercase outline-none', selBtn)}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"><path d="M6 9l6 6 6-6" /></svg>
            </div>
            <div className="relative flex-1">
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={cn('w-full appearance-none rounded-none font-mono text-[13px] font-semibold text-foreground outline-none', selBtn)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"><path d="M6 9l6 6 6-6" /></svg>
            </div>
          </div>
          <div className="mb-1.5 grid grid-cols-7 gap-[3px]">
            {WEEKDAYS.map((w, i) => <p key={i} className="text-center font-heading text-[10px] font-semibold tracking-wide text-faint">{w}</p>)}
          </div>
          <div className="grid grid-cols-7 gap-[3px]">
            {cells.map((c, i) => {
              if (!c) return <span key={i} />
              const selected = value === c.iso
              return (
                <button
                  key={i}
                  type="button"
                  disabled={c.future}
                  aria-pressed={selected}
                  onClick={() => { onChange(c.iso); setOpen(false); onBlur?.() }}
                  className={cn(
                    'flex aspect-square min-h-8 items-center justify-center rounded-none font-mono text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
                    c.future ? 'cursor-default text-faint/50' : selected ? 'bg-foreground text-accent' : 'text-foreground hover:bg-accent/30',
                  )}
                >
                  {c.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
