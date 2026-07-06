import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface CalendarProps {
  value?: string // ISO yyyy-mm-dd
  onSelect: (iso: string) => void
  fromYear?: number
  toYear?: number
  maxDate?: string // ISO — days after this are disabled
  className?: string
}

function toIso(y: number, m: number, d: number) {
  return `${y.toString().padStart(4, "0")}-${(m + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`
}

export function Calendar({ value, onSelect, fromYear = 1950, toYear = new Date().getFullYear(), maxDate, className }: CalendarProps) {
  const selected = value ? new Date(value + "T00:00:00") : null
  const initial = selected ?? new Date(Math.min(toYear, new Date().getFullYear()), 0, 1)
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const max = maxDate ? new Date(maxDate + "T00:00:00") : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function isDisabled(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    if (max && d > max) return true
    return false
  }

  function goMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewYear(y)
    setViewMonth(m)
  }

  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)

  return (
    <div className={cn("w-[280px]", className)}>
      <div className="mb-3 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => goMonth(-1)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        <Select
          value={String(viewMonth)}
          onValueChange={(v) => setViewMonth(Number(v ?? viewMonth))}
          items={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
        >
          <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(viewYear)}
          onValueChange={(v) => setViewYear(Number(v ?? viewYear))}
          items={years.map((y) => ({ value: String(y), label: String(y) }))}
        >
          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => goMonth(1)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />
          const disabled = isDisabled(day)
          const isSelected = selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day
          const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(toIso(viewYear, viewMonth, day))}
              className={cn(
                "flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                "hover:bg-muted disabled:pointer-events-none disabled:opacity-30",
                isToday && !isSelected && "ring-1 ring-inset ring-[var(--bright-green)]",
                isSelected && "bg-[var(--gold)] font-medium text-[#08140E] hover:bg-[var(--gold)]",
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
