import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EventRow } from '@/lib/types'

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false })
      setEvents(data ?? [])
      if (data && data.length > 0) setSelectedEventId(data[0].id)
      setLoading(false)
    }
    load()
  }, [])

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null

  return { events, selectedEventId, setSelectedEventId, selectedEvent, loading }
}
