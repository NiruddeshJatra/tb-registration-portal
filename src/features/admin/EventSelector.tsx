import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EventRow } from '@/lib/types'

interface Props {
  events: EventRow[]
  selectedEventId: string
  onChange: (id: string) => void
}

export function EventSelector({ events, selectedEventId, onChange }: Props) {
  if (events.length === 0) return null
  return (
    <Select
      value={selectedEventId}
      onValueChange={(v) => onChange(v ?? '')}
      items={events.map((e) => ({ value: e.id, label: e.name }))}
    >
      <SelectTrigger className="h-10 w-full sm:w-72">
        <SelectValue placeholder="Select event" />
      </SelectTrigger>
      <SelectContent>
        {events.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
