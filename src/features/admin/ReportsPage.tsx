import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadExcel } from '@/lib/xlsxExport'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DashLoader } from '@/components/brand/DashLoader'
import { cn } from '@/lib/utils'
import type { CategoryRow } from '@/lib/types'

const ALL = '__all__'
const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']

export function ReportsPage() {
  const { events, selectedEventId, setSelectedEventId, selectedEvent } = useEvents()
  const [jerseyRole, setJerseyRole] = useState<'all' | 'runner' | 'crew'>('all')
  const [generalStatus, setGeneralStatus] = useState(ALL)
  const [busy, setBusy] = useState<string | null>(null)

  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  async function exportJerseyReport() {
    setBusy('jersey')
    const { data: cats } = await supabase.from('categories').select('*').eq('event_id', selectedEventId).order('display_order')
    let query = supabase.from('registrations').select('category_id, jersey_size, participant_role').eq('event_id', selectedEventId)
    if (jerseyRole === 'runner') query = query.eq('participant_role', 'runner')
    if (jerseyRole === 'crew') query = query.neq('participant_role', 'runner')
    const { data: regs } = await query

    const categories = (cats ?? []) as CategoryRow[]
    const rows = categories.map((c) => {
      const row: Record<string, unknown> = { Category: c.name }
      for (const size of JERSEY_SIZES) row[size] = (regs ?? []).filter((r) => r.category_id === c.id && r.jersey_size === size).length
      row.Total = (regs ?? []).filter((r) => r.category_id === c.id).length
      return row
    })
    const noCategory = (regs ?? []).filter((r) => !r.category_id)
    if (noCategory.length > 0) {
      const row: Record<string, unknown> = { Category: 'N/A' }
      for (const size of JERSEY_SIZES) row[size] = noCategory.filter((r) => r.jersey_size === size).length
      row.Total = noCategory.length
      rows.push(row)
    }
    downloadExcel(`jersey-report-${selectedEvent?.slug ?? 'event'}.xlsx`, 'Jersey Report', rows)
    setBusy(null)
  }

  async function exportTimingPartnerReport() {
    setBusy('timing')
    const { data } = await supabase
      .from('registrations')
      .select('ref_code, full_name, gender, date_of_birth, phone, categories(name)')
      .eq('event_id', selectedEventId)
      .eq('status', 'approved')
    const rows = (data ?? []).map((r) => ({
      'Ref Code': r.ref_code,
      Name: r.full_name,
      Gender: r.gender,
      DOB: r.date_of_birth,
      Category: (r.categories as unknown as { name: string } | null)?.name ?? '',
      Phone: r.phone,
    }))
    downloadExcel(`timing-partner-${selectedEvent?.slug ?? 'event'}.xlsx`, 'Timing Partner', rows)
    setBusy(null)
  }

  async function exportGeneralReport() {
    setBusy('general')
    let query = supabase
      .from('registrations')
      .select('ref_code, full_name, phone, jersey_size, participant_role, registration_type, status, transaction_id, created_at, categories(name)')
      .eq('event_id', selectedEventId)
    if (generalStatus !== ALL) query = query.eq('status', generalStatus)
    const { data } = await query.order('created_at', { ascending: false })
    const rows = (data ?? []).map((r) => ({
      'Ref Code': r.ref_code,
      Name: r.full_name,
      Phone: r.phone,
      Category: (r.categories as unknown as { name: string } | null)?.name ?? '',
      Jersey: r.jersey_size,
      Role: r.participant_role,
      Type: r.registration_type,
      Status: r.status,
      'Transaction ID': r.transaction_id,
      Created: r.created_at,
    }))
    downloadExcel(`registrations-${selectedEvent?.slug ?? 'event'}.xlsx`, 'Registrations', rows)
    setBusy(null)
  }

  const cards = [
    {
      num: '01',
      title: 'Jersey Report',
      desc: 'Category × size pivot for the T-shirt order.',
      onClick: exportJerseyReport,
      key: 'jersey',
      filter: (
        <Select value={jerseyRole} onValueChange={(v) => setJerseyRole((v ?? 'all') as typeof jerseyRole)} items={[{ value: 'all', label: 'All participants' }, { value: 'runner', label: 'Runners only' }, { value: 'crew', label: 'Crew only' }]}>
          <SelectTrigger className="h-[38px] w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All participants</SelectItem><SelectItem value="runner">Runners only</SelectItem><SelectItem value="crew">Crew only</SelectItem></SelectContent>
        </Select>
      ),
    },
    {
      num: '02',
      title: 'Timing Partner Export',
      desc: 'Approved registrations only — ref, name, gender, DOB, category, phone.',
      onClick: exportTimingPartnerReport,
      key: 'timing',
      filter: null,
    },
    {
      num: '03',
      title: 'General Export',
      desc: 'Full registration list, optionally filtered by status.',
      onClick: exportGeneralReport,
      key: 'general',
      filter: (
        <Select value={generalStatus} onValueChange={(v) => setGeneralStatus(v ?? ALL)} items={[{ value: ALL, label: 'All status' }, ...['pending', 'approved', 'rejected', 'cancelled'].map((s) => ({ value: s, label: s }))]}>
          <SelectTrigger className="h-[38px] w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All status</SelectItem>{['pending', 'approved', 'rejected', 'cancelled'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
        </Select>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-page-header">
        <div>
          <h1>Exports</h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">Excel downloads, generated client-side from the live table.</p>
        </div>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        {cards.map((c) => (
          <div key={c.key} className="flex flex-col border border-border bg-card">
            <div className="flex items-baseline justify-between px-5 pt-4">
              <p className="font-mono text-[26px] font-semibold text-accent">{c.num}</p>
              <p className="font-mono text-[9.5px] text-faint">.XLSX</p>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 px-5 pt-2 pb-4">
              <p className="font-heading text-[15px] font-semibold tracking-[0.08em] uppercase">{c.title}</p>
              <p className="text-[12px] leading-[1.6] text-muted-foreground">{c.desc}</p>
              {c.filter && <div className="mt-auto">{c.filter}</div>}
              <button
                type="button"
                onClick={c.onClick}
                disabled={busy === c.key}
                className={cn('flex h-[42px] items-center justify-center gap-2 border border-accent font-heading text-[11px] font-semibold tracking-[0.2em] text-accent uppercase transition-colors hover:bg-accent/[0.08] disabled:opacity-50', !c.filter && 'mt-auto')}
              >
                {busy === c.key ? <DashLoader inline label="জেনারেট হচ্ছে…" /> : '↓ Download Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

