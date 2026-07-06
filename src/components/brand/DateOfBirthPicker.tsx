import { useEffect, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface Props {
  id?: string
  value: string // ISO yyyy-mm-dd, or ''
  onChange: (iso: string) => void
  max?: string // ISO — dates after this are disabled/rejected
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

// Returns ISO yyyy-mm-dd for a valid, real dd/mm/yyyy string, else null.
function displayToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
}

// Typeable dd/mm/yyyy input, kept in sync with a shadcn-style Calendar in a Popover.
export function DateOfBirthPicker({ id, value, onChange, max }: Props) {
  const [text, setText] = useState(() => isoToDisplay(value))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setText(isoToDisplay(value))
  }, [value])

  function handleTextChange(raw: string) {
    setText(raw)
    const iso = displayToIso(raw)
    if (iso && (!max || iso <= max)) onChange(iso)
  }

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        className="h-11 flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Open calendar" />}
        >
          <CalendarIcon className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end">
          <Calendar
            value={value || undefined}
            maxDate={max}
            fromYear={1950}
            toYear={max ? new Date(max).getFullYear() : new Date().getFullYear()}
            onSelect={(iso) => {
              onChange(iso)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
