import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleLineChart } from '@/components/brand/SimpleLineChart'
import type { CategoryRow, RegistrationStatus } from '@/lib/types'

interface StatsRow {
  category_id: string | null
  jersey_size: string | null
  status: RegistrationStatus
  payment_method: string | null
  created_at: string
}

const STATUSES: RegistrationStatus[] = ['pending', 'approved', 'rejected', 'cancelled']

export function DashboardPage() {
  const { events, selectedEventId, setSelectedEventId, selectedEvent, loading: eventsLoading } = useEvents()
  const [rows, setRows] = useState<StatsRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedEventId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: regs }, { data: cats }] = await Promise.all([
        supabase
          .from('registrations')
          .select('category_id, jersey_size, status, payment_method, created_at')
          .eq('event_id', selectedEventId),
        supabase.from('categories').select('*').eq('event_id', selectedEventId).order('display_order'),
      ])
      if (cancelled) return
      setRows(regs ?? [])
      setCategories(cats ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedEventId])

  if (eventsLoading) return <p className="text-muted-foreground">Loading...</p>
  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  const byStatus = STATUSES.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }))
  const total = rows.length

  const byCategory = categories.map((c) => ({
    name: c.name,
    count: rows.filter((r) => r.category_id === c.id).length,
  }))

  const jerseySizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
  const bySize = jerseySizes.map((s) => ({ size: s, count: rows.filter((r) => r.jersey_size === s).length }))

  const byPayment = ['bKash', 'Nagad'].map((m) => ({ method: m, count: rows.filter((r) => r.payment_method === m).length }))

  const dayCounts = new Map<string, number>()
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
  }
  const sortedDays = Array.from(dayCounts.keys()).sort()
  let running = 0
  const overTime = sortedDays.map((day) => {
    running += dayCounts.get(day)!
    return { label: day.slice(5), value: running }
  })

  return (
    <div className="space-y-6">
      <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />

      {loading ? (
        <p className="text-muted-foreground">Loading stats...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-foreground">
                {total}
                {selectedEvent?.max_total_slots ? <span className="text-sm text-muted-foreground"> / {selectedEvent.max_total_slots}</span> : null}
              </CardContent>
            </Card>
            {byStatus.map((s) => (
              <Card key={s.status}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize text-muted-foreground">{s.status}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-foreground">{s.count}</CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registrations Over Time (cumulative)</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleLineChart data={overTime} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="font-medium text-foreground">{c.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Jersey Size</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bySize.map((s) => (
                  <div key={s.size} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{s.size}</span>
                    <span className="font-medium text-foreground">{s.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byPayment.map((p) => (
                  <div key={p.method} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{p.method}</span>
                    <span className="font-medium text-foreground">{p.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
