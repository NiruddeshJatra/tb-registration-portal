import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { DashLoader } from '@/components/brand/DashLoader'
import { CountUp } from '@/components/brand/CountUp'
import { formatTaka } from '@/lib/format'
import { cn } from '@/lib/utils'
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

interface ActivityRow {
  ref_code: string | null
  full_name: string
  status: RegistrationStatus
  entry_source: string
  created_at: string
}

const STATUS_META: { key: RegistrationStatus; label: string; color: string }[] = [
  { key: 'pending', label: 'Pending', color: 'var(--status-pending)' },
  { key: 'approved', label: 'Approved', color: 'var(--status-approved)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--status-rejected)' },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--status-cancelled)' },
]
const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('border border-border bg-card', className)}>{children}</div>
}
function PanelLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border px-[18px] py-3.5">
      <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">{children}</p>
      {right}
    </div>
  )
}

function heat(v: number): { bg: string; color: string } {
  if (v === 0) return { bg: 'transparent', color: 'var(--disabled, #4A4F3D)' }
  if (v < 5) return { bg: 'rgba(198,245,63,.08)', color: 'var(--muted-foreground)' }
  if (v < 15) return { bg: 'rgba(198,245,63,.18)', color: 'var(--foreground)' }
  return { bg: 'rgba(198,245,63,.34)', color: 'var(--foreground)' }
}

export function DashboardPage() {
  const { events, selectedEventId, setSelectedEventId, selectedEvent, loading: eventsLoading } = useEvents()
  const [rows, setRows] = useState<StatsRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedEventId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: regs }, { data: cats }, { data: recent }] = await Promise.all([
        supabase
          .from('registrations')
          .select('category_id, jersey_size, status, payment_method, created_at, amount_paid, registration_type')
          .eq('event_id', selectedEventId),
        supabase.from('categories').select('*').eq('event_id', selectedEventId).order('display_order'),
        supabase
          .from('registrations')
          .select('ref_code, full_name, status, entry_source, created_at')
          .eq('event_id', selectedEventId)
          .order('created_at', { ascending: false })
          .limit(6),
      ])
      if (cancelled) return
      setRows(regs ?? [])
      setCategories(cats ?? [])
      setActivity((recent as ActivityRow[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedEventId])

  const header = (
    <div className="admin-page-header">
      <h1>Dashboard</h1>
      <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
    </div>
  )

  if (eventsLoading) return <DashLoader label="লোড হচ্ছে…" />
  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  const total = rows.length
  const cap = selectedEvent?.max_total_slots ?? null
  const pct = cap ? Math.min(100, Math.round((total / cap) * 100)) : null
  const segCount = 25
  const filledSegs = cap ? Math.round((total / cap) * segCount) : 0

  const now = Date.now()
  const WEEK = 7 * 86400000
  const statusData = STATUS_META.map((m) => {
    const list = rows.filter((r) => r.status === m.key)
    const thisWeek = list.filter((r) => now - new Date(r.created_at).getTime() < WEEK).length
    let hint = `+${thisWeek} this week`
    if (m.key === 'pending' && list.length) {
      const oldest = Math.min(...list.map((r) => new Date(r.created_at).getTime()))
      const days = Math.floor((now - oldest) / 86400000)
      hint = days <= 0 ? 'oldest today' : `oldest ${days} day${days === 1 ? '' : 's'} ago`
    }
    return { ...m, count: list.length, hint }
  })

  const feeFor = (categoryId: string | null) => categories.find((c) => c.id === categoryId)?.fee ?? 0
  const revenueOf = (r: StatsRow) => r.amount_paid ?? feeFor(r.category_id)
  const isBillable = (r: StatsRow) => r.registration_type !== 'complimentary'
  const verifiedRevenue = rows.filter((r) => r.status === 'approved' && isBillable(r)).reduce((s, r) => s + revenueOf(r), 0)
  const pendingRevenue = rows.filter((r) => r.status === 'pending' && isBillable(r)).reduce((s, r) => s + revenueOf(r), 0)
  const approvedCount = rows.filter((r) => r.status === 'approved' && isBillable(r)).length
  const pendingCount = rows.filter((r) => r.status === 'pending' && isBillable(r)).length

  const activeRows = rows.filter((r) => r.status === 'pending' || r.status === 'approved')
  const byCategory = categories.map((c) => {
    const catRows = activeRows.filter((r) => r.category_id === c.id)
    return {
      name: c.name,
      count: catRows.length,
      revenue: catRows.filter((r) => r.status === 'approved' && isBillable(r)).reduce((s, r) => s + revenueOf(r), 0),
    }
  })
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count))

  const paymentSplit = ['bKash', 'Nagad', 'Rocket', 'Upay']
    .map((m) => ({ m, n: rows.filter((r) => r.payment_method === m).length }))
    .filter((p) => p.n > 0)

  const matrix = categories.map((c) => ({
    name: c.name,
    cells: JERSEY_SIZES.map((s) => activeRows.filter((r) => r.category_id === c.id && r.jersey_size === s).length),
  }))
  const colTotals = JERSEY_SIZES.map((_, i) => matrix.reduce((s, row) => s + row.cells[i], 0))
  const grandTotal = colTotals.reduce((a, b) => a + b, 0)

  // cumulative-over-time points
  const dayCounts = new Map<string, number>()
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
  }
  const sortedDays = Array.from(dayCounts.keys()).sort()
  let running = 0
  const cumulative = sortedDays.map((day) => {
    running += dayCounts.get(day)!
    return { day, value: running }
  })

  function LineChart() {
    const W = 560, H = 96, top = 6, bottom = 88
    if (cumulative.length === 0) return <div className="h-[96px]" />
    const maxV = Math.max(1, cumulative[cumulative.length - 1].value)
    const pts = cumulative.map((p, i) => {
      const x = cumulative.length === 1 ? W : (i / (cumulative.length - 1)) * W
      const y = bottom - (p.value / maxV) * (bottom - top)
      return { x, y }
    })
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ')
    const area = `${line} L${W},${bottom} L0,${bottom} Z`
    const last = pts[pts.length - 1]
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2.5 block w-full" aria-hidden="true">
        <line x1="0" y1="88" x2={W} y2="88" stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1="56" x2={W} y2="56" stroke="var(--card-2)" strokeWidth="1" />
        <line x1="0" y1="24" x2={W} y2="24" stroke="var(--card-2)" strokeWidth="1" />
        <path d={area} fill="rgba(198,245,63,.08)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--accent)" />
        <text x={last.x - 6} y={last.y - 8} fontFamily="'IBM Plex Mono'" fontSize="9" fill="var(--accent)" textAnchor="end">{maxV}</text>
      </svg>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {header}

      {loading ? (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sl-skeleton h-[108px]" />)}
          </div>
          <div className="sl-skeleton h-[220px]" />
          <p className="mt-1 flex items-center gap-2.5 font-mono text-[11px] text-faint">
            <svg width="60" height="10" viewBox="0 0 60 10" aria-hidden="true"><line x1="2" y1="5" x2="58" y2="5" stroke="var(--accent)" strokeWidth="2" strokeDasharray="8 4" style={{ animation: 'sl-dash .5s linear infinite' }} /></svg>
            FETCHING REGISTRATIONS…
          </p>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3.5 border border-dashed border-border-strong p-16 text-center">
          <svg width="140" height="26" viewBox="0 0 140 26" aria-hidden="true">
            <line x1="4" y1="13" x2="136" y2="13" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 5" />
            <circle cx="4" cy="13" r="3.5" fill="var(--background)" stroke="var(--faint)" strokeWidth="1.5" />
            <circle cx="47" cy="13" r="3.5" fill="var(--background)" stroke="var(--faint)" strokeWidth="1.5" />
            <circle cx="104" cy="13" r="3.5" fill="var(--background)" stroke="var(--faint)" strokeWidth="1.5" />
            <rect x="132" y="4" width="3" height="18" fill="var(--faint)" />
          </svg>
          <p className="font-heading text-[17px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Start list is empty</p>
          <p className="text-[13px] text-faint" lang="bn">এখনও কোনো registration নেই — ফর্ম লিংক শেয়ার করুন।</p>
          <p className="font-mono text-[11px] text-accent">register.triathlonbangladesh.com/register/{selectedEvent?.slug}</p>
        </div>
      ) : (
        <>
          {/* row 1: slots + statuses */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
            <Panel className="px-5 py-[18px]">
              <div className="flex items-baseline justify-between">
                <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">Slots claimed</p>
                {pct !== null && <p className="font-mono text-[10px] text-accent">{pct}%</p>}
              </div>
              <p className="mt-2.5 font-heading text-[38px] leading-none font-semibold">
                <CountUp value={total} />
                {cap ? <span className="text-[17px] text-faint"> / {cap}</span> : null}
              </p>
              {cap && (
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: segCount }, (_, i) => (
                    <div key={i} className="h-2 flex-1" style={{ background: i < filledSegs ? 'var(--accent)' : 'var(--card-2)' }} />
                  ))}
                </div>
              )}
            </Panel>
            {statusData.map((s) => (
              <div key={s.key} className="border border-border bg-card px-5 py-[18px]" style={{ borderTop: `2px solid ${s.color}` }}>
                <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">{s.label}</p>
                <p className="mt-2.5 font-heading text-[38px] leading-none font-semibold" style={{ color: s.key === 'pending' || s.key === 'approved' ? s.color : 'var(--foreground)' }}>
                  <CountUp value={s.count} />
                </p>
                <p className="mt-2 font-mono text-[10px] text-faint">{s.hint}</p>
              </div>
            ))}
          </div>

          {/* row 2: revenue + chart */}
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_1fr_2fr]">
            <Panel className="px-5 py-[18px]">
              <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">Verified revenue</p>
              <p className="mt-2.5 font-mono text-[26px] font-semibold text-accent"><CountUp value={verifiedRevenue} format={formatTaka} /></p>
              <p className="mt-2 font-mono text-[10px] text-faint">{approvedCount} approved</p>
            </Panel>
            <Panel className="px-5 py-[18px]">
              <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">Pending revenue</p>
              <p className="mt-2.5 font-mono text-[26px] font-semibold" style={{ color: 'var(--status-pending)' }}><CountUp value={pendingRevenue} format={formatTaka} /></p>
              <p className="mt-2 font-mono text-[10px] text-faint">{pendingCount} awaiting verification</p>
            </Panel>
            <Panel className="px-5 py-[18px]">
              <div className="flex items-baseline justify-between">
                <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">Registrations — cumulative</p>
                {cumulative.length > 0 && <p className="font-mono text-[10px] text-faint">{cumulative[0].day.slice(5)} — {cumulative[cumulative.length - 1].day.slice(5)}</p>}
              </div>
              <LineChart />
            </Panel>
          </div>

          {/* row 3: categories + matrix + activity */}
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[1.1fr_1.6fr_1.1fr] lg:items-start">
            <Panel>
              <PanelLabel>By category</PanelLabel>
              <div className="px-[18px] pt-1.5 pb-3.5">
                {byCategory.map((c) => (
                  <div key={c.name} className="border-b border-card-2 py-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12.5px]">{c.name}</span>
                      <span className="font-mono text-xs">{c.count} <span className="text-faint">· {formatTaka(c.revenue)}</span></span>
                    </div>
                    <div className="mt-[7px] h-1 bg-card-2">
                      <div className="h-full bg-accent" style={{ width: `${Math.round((c.count / maxCat) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {paymentSplit.length > 0 && (
                  <div className="flex justify-between pt-3">
                    <span className="font-heading text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Payment split</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{paymentSplit.map((p) => `${p.m} ${p.n}`).join(' · ')}</span>
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelLabel right={<p className="font-mono text-[10px] text-faint">active only</p>}>Category × jersey — t-shirt order</PanelLabel>
              <div className="overflow-x-auto px-[18px] pt-2.5 pb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="px-1 py-1.5 text-left font-heading text-[9px] font-semibold tracking-[0.18em] text-faint uppercase">Category</th>
                      {JERSEY_SIZES.map((s) => <th key={s} className="px-1 py-1.5 text-center font-mono text-[10px] text-faint">{s}</th>)}
                      <th className="px-1 py-1.5 text-right font-heading text-[9px] font-semibold tracking-[0.18em] text-faint uppercase">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row) => {
                      const rowTotal = row.cells.reduce((a, b) => a + b, 0)
                      return (
                        <tr key={row.name} className="border-t border-card-2">
                          <td className="px-1 py-[7px] text-[12px] whitespace-nowrap">{row.name}</td>
                          {row.cells.map((v, i) => {
                            const h = heat(v)
                            return <td key={i} className="p-1"><div className="min-w-[26px] py-1 text-center font-mono text-[11px]" style={{ background: h.bg, color: h.color }}>{v}</div></td>
                          })}
                          <td className="px-1 py-[7px] text-right font-mono text-[12px] font-semibold text-accent">{rowTotal}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-border">
                      <td className="px-1 py-[7px] font-heading text-[9px] font-semibold tracking-[0.18em] text-faint uppercase">Order</td>
                      {colTotals.map((t, i) => <td key={i} className="px-1 py-[7px] text-center font-mono text-[11px] font-semibold">{t}</td>)}
                      <td className="px-1 py-[7px] text-right font-mono text-[12px] font-semibold">{grandTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel>
              <PanelLabel>Recent activity</PanelLabel>
              <div className="px-[18px] pt-2 pb-3.5">
                {activity.length === 0 ? (
                  <p className="py-4 text-center font-mono text-[11px] text-faint">No activity yet</p>
                ) : (
                  activity.map((a, i) => {
                    const meta = STATUS_META.find((m) => m.key === a.status)
                    return (
                      <div key={i} className="flex items-baseline gap-2.5 border-b border-card-2 py-2">
                        <span className="font-mono text-[9.5px] whitespace-nowrap text-faint">{new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                        <div>
                          <p className="text-[12px]">{a.entry_source === 'admin_manual' ? 'Manual entry: ' : ''}{a.full_name}</p>
                          <p className="mt-px font-mono text-[10px] uppercase" style={{ color: meta?.color }}>{a.ref_code} · {a.status}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
