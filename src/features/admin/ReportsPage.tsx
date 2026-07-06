import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadExcel } from '@/lib/xlsxExport'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
      for (const size of JERSEY_SIZES) {
        row[size] = (regs ?? []).filter((r) => r.category_id === c.id && r.jersey_size === size).length
      }
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

  return (
    <div className="space-y-6">
      <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />

      <Card>
        <CardHeader>
          <CardTitle>Jersey Report</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select
            value={jerseyRole}
            onValueChange={(v) => setJerseyRole(v as typeof jerseyRole)}
            items={[
              { value: 'all', label: 'All Participants' },
              { value: 'runner', label: 'Runners Only' },
              { value: 'crew', label: 'Crew Only' },
            ]}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Participants</SelectItem>
              <SelectItem value="runner">Runners Only</SelectItem>
              <SelectItem value="crew">Crew Only</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportJerseyReport} disabled={busy === 'jersey'}>
            {busy === 'jersey' ? 'Generating...' : 'Download Excel'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timing Partner Export</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Approved registrations only.</p>
          <Button onClick={exportTimingPartnerReport} disabled={busy === 'timing'}>
            {busy === 'timing' ? 'Generating...' : 'Download Excel'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General Export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select
            value={generalStatus}
            onValueChange={(v) => setGeneralStatus(v ?? ALL)}
            items={[
              { value: ALL, label: 'All Status' },
              ...['pending', 'approved', 'rejected', 'cancelled'].map((s) => ({ value: s, label: s })),
            ]}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Status</SelectItem>
              {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportGeneralReport} disabled={busy === 'general'}>
            {busy === 'general' ? 'Generating...' : 'Download Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
