import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleLineChart } from '@/components/brand/SimpleLineChart'
import { BrandLoader } from '@/components/brand/BrandLoader'
import { CountUp } from '@/components/brand/CountUp'
import { formatTaka } from '@/lib/format'
import type { CategoryRow, RegistrationStatus, RegistrationType } from '@/lib/types'

interface StatsRow {
  category_id: string | null
  jersey_size: string | null
  status: RegistrationStatus
  payment_method: string | null
  created_at: string
  amount_paid: number | null
  registration_type: RegistrationType
}

const STATUSES: RegistrationStatus[] = ['pending', 'approved', 'rejected', 'cancelled']
const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const

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
          .select('category_id, jersey_size, status, payment_method, created_at, amount_paid, registration_type')
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

  if (eventsLoading) return <BrandLoader />
  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  const byStatus = STATUSES.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }))
  const total = rows.length

  const feeFor = (categoryId: string | null) => categories.find((c) => c.id === categoryId)?.fee ?? 0
  const revenueOf = (r: StatsRow) => r.amount_paid ?? feeFor(r.category_id)
  const isBillable = (r: StatsRow) => r.registration_type !== 'complimentary'

  const verifiedRevenue = rows
    .filter((r) => r.status === 'approved' && isBillable(r))
    .reduce((sum, r) => sum + revenueOf(r), 0)
  const pendingRevenue = rows
    .filter((r) => r.status === 'pending' && isBillable(r))
    .reduce((sum, r) => sum + revenueOf(r), 0)

  const activeRows = rows.filter((r) => r.status === 'pending' || r.status === 'approved')

  const byCategory = categories.map((c) => {
    const catRows = activeRows.filter((r) => r.category_id === c.id)
    return {
      name: c.name,
      count: catRows.length,
      revenue: catRows.filter((r) => r.status === 'approved' && isBillable(r)).reduce((sum, r) => sum + revenueOf(r), 0),
    }
  })

  const jerseySizes = JERSEY_SIZES
  const bySize = jerseySizes.map((s) => ({ size: s, count: rows.filter((r) => r.jersey_size === s).length }))
  const jerseyMatrix = categories.map((c) => ({
    name: c.name,
    sizes: jerseySizes.map((s) => activeRows.filter((r) => r.category_id === c.id && r.jersey_size === s).length),
  }))

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
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      {loading ? (
        <BrandLoader />
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <p className="text-lg">এখনও কোনো registration নেই</p>
          <p className="text-sm">No registrations yet for this event.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-foreground">
                <CountUp value={total} />
                {selectedEvent?.max_total_slots ? <span className="text-sm text-muted-foreground"> / {selectedEvent.max_total_slots}</span> : null}
              </CardContent>
            </Card>
            {byStatus.map((s) => (
              <Card key={s.status}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize text-muted-foreground">{s.status}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-foreground">
                  <CountUp value={s.count} />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Verified Revenue</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums text-foreground">
                <CountUp value={verifiedRevenue} format={formatTaka} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pending Revenue</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums text-foreground">
                <CountUp value={pendingRevenue} format={formatTaka} />
              </CardContent>
            </Card>
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
                    <span className="font-medium text-foreground">
                      {c.count} &middot; <span className="tabular-nums">{formatTaka(c.revenue)}</span>
                    </span>
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

          <Card>
            <CardHeader>
              <CardTitle>Category &times; Jersey Size (T-shirt order preview)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 text-left font-medium text-muted-foreground">Category</th>
                    {jerseySizes.map((s) => (
                      <th key={s} className="px-2 py-1 text-right font-medium text-muted-foreground">{s}</th>
                    ))}
                    <th className="px-2 py-1 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {jerseyMatrix.map((row) => (
                    <tr key={row.name} className="border-b border-border last:border-0">
                      <td className="py-1 text-foreground">{row.name}</td>
                      {row.sizes.map((count, i) => (
                        <td key={jerseySizes[i]} className="px-2 py-1 text-right tabular-nums text-foreground">{count}</td>
                      ))}
                      <td className="px-2 py-1 text-right font-medium tabular-nums text-foreground">
                        {row.sizes.reduce((a, b) => a + b, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
