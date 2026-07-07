import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DashLoader } from '@/components/brand/DashLoader'
import { cn } from '@/lib/utils'
import type { CategoryRow, Gender } from '@/lib/types'

const emptyDraft = { name: '', gender: 'male' as Gender, min_age: 18, max_age: '' as number | '', fee: 0, max_slots: '' as number | '', display_order: 0 }

function AdminLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('font-heading text-[9.5px] font-semibold tracking-[0.22em] text-muted-foreground uppercase', className)}>{children}</label>
}

export function EventConfigPage() {
  const { events, selectedEventId, setSelectedEventId, selectedEvent } = useEvents()
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [maxTotalSlots, setMaxTotalSlots] = useState<number | ''>('')
  const [paymentNumber, setPaymentNumber] = useState('')
  const [feeNote, setFeeNote] = useState('')
  const [savingEvent, setSavingEvent] = useState(false)

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [newCategory, setNewCategory] = useState(emptyDraft)
  const [adding, setAdding] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    if (!selectedEvent) return
    setRegistrationOpen(selectedEvent.registration_open)
    setDeadline(selectedEvent.registration_deadline ?? '')
    setMaxTotalSlots(selectedEvent.max_total_slots ?? '')
    setPaymentNumber(selectedEvent.payment_number ?? '')
    setFeeNote(selectedEvent.fee_note ?? '')
  }, [selectedEvent])

  useEffect(() => {
    if (!selectedEventId) return
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId])

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').eq('event_id', selectedEventId).order('display_order')
    setCategories(data ?? [])
  }

  async function saveEvent() {
    if (!selectedEventId) return
    setSavingEvent(true)
    await supabase
      .from('events')
      .update({
        registration_open: registrationOpen,
        registration_deadline: deadline || null,
        max_total_slots: maxTotalSlots === '' ? null : maxTotalSlots,
        payment_number: paymentNumber || null,
        fee_note: feeNote || null,
      })
      .eq('id', selectedEventId)
    setSavingEvent(false)
  }

  async function updateCategory(id: string, patch: Partial<CategoryRow>) {
    await supabase.from('categories').update(patch).eq('id', id)
    loadCategories()
  }
  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Existing registrations keep their category reference.')) return
    await supabase.from('categories').delete().eq('id', id)
    loadCategories()
  }
  async function addCategory() {
    if (!selectedEventId || !newCategory.name.trim()) return
    setSavingCategory(true)
    await supabase.from('categories').insert({
      event_id: selectedEventId,
      name: newCategory.name,
      gender: newCategory.gender,
      min_age: newCategory.min_age,
      max_age: newCategory.max_age === '' ? null : newCategory.max_age,
      fee: newCategory.fee,
      max_slots: newCategory.max_slots === '' ? null : newCategory.max_slots,
      display_order: newCategory.display_order,
    })
    setSavingCategory(false)
    setNewCategory(emptyDraft)
    setAdding(false)
    loadCategories()
  }

  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="admin-page-header">
        <div>
          <h1>Event config</h1>
          {selectedEvent && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{selectedEvent.name} · {selectedEvent.short_code}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 border px-4 py-2" style={{ borderColor: registrationOpen ? 'var(--status-approved)' : 'var(--border)', background: registrationOpen ? 'rgba(198,245,63,.06)' : 'transparent' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: registrationOpen ? 'var(--accent)' : 'var(--faint)' }} />
            <span className="font-heading text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: registrationOpen ? 'var(--accent)' : 'var(--faint)' }}>
              {registrationOpen ? 'Registration live' : 'Registration closed'}
            </span>
          </div>
          <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[380px_1fr] lg:items-start">
        {/* gate settings */}
        <div className="border border-border bg-card">
          <p className="border-b border-border px-5 py-3 font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">Gate settings</p>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px]">Registration open</p>
                <p className="mt-0.5 text-[11px] text-faint">Public form accepts entries</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={registrationOpen}
                onClick={() => setRegistrationOpen((o) => !o)}
                className="relative h-6 w-11 shrink-0"
                style={{ background: registrationOpen ? 'var(--accent)' : 'var(--border-strong)' }}
              >
                <span className="absolute top-[3px] h-[18px] w-[18px] transition-all" style={{ background: registrationOpen ? 'var(--background)' : 'var(--faint)', right: registrationOpen ? 3 : 23 }} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <AdminLabel>Registration deadline</AdminLabel>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <AdminLabel>Max total slots</AdminLabel>
              <Input type="number" placeholder="unlimited" value={maxTotalSlots} onChange={(e) => setMaxTotalSlots(e.target.value === '' ? '' : Number(e.target.value))} className="h-10 font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <AdminLabel>Payment number</AdminLabel>
              <Input value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} className="h-10 font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <AdminLabel>Fee note</AdminLabel>
              <Textarea value={feeNote} onChange={(e) => setFeeNote(e.target.value)} rows={3} />
            </div>
            <button
              type="button"
              onClick={saveEvent}
              disabled={savingEvent}
              className="flex h-[42px] items-center justify-center bg-accent font-heading text-[11px] font-semibold tracking-[0.2em] text-accent-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingEvent ? <DashLoader inline label="সেভ হচ্ছে…" /> : 'Save settings'}
            </button>
          </div>
        </div>

        {/* categories */}
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">Categories · {categories.length}</p>
            <button type="button" onClick={() => setAdding((a) => !a)} className="border border-border-strong px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
              {adding ? '− Cancel' : '+ Add category'}
            </button>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {categories.map((c) => (
              <div key={c.id} className="grid grid-cols-2 gap-2 border border-border p-3 sm:grid-cols-7 sm:items-end">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <AdminLabel>Name</AdminLabel>
                  <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && updateCategory(c.id, { name: e.target.value })} className="h-9" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Gender</AdminLabel>
                  <Select defaultValue={c.gender} onValueChange={(v) => v && updateCategory(c.id, { gender: v as Gender })} items={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Min age</AdminLabel>
                  <Input type="number" defaultValue={c.min_age} onBlur={(e) => updateCategory(c.id, { min_age: Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Max age</AdminLabel>
                  <Input type="number" defaultValue={c.max_age ?? ''} placeholder="none" onBlur={(e) => updateCategory(c.id, { max_age: e.target.value === '' ? null : Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Fee</AdminLabel>
                  <Input type="number" defaultValue={c.fee} onBlur={(e) => updateCategory(c.id, { fee: Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Max slots</AdminLabel>
                  <Input type="number" defaultValue={c.max_slots ?? ''} placeholder="∞" onBlur={(e) => updateCategory(c.id, { max_slots: e.target.value === '' ? null : Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <button type="button" onClick={() => deleteCategory(c.id)} className="h-9 border font-heading text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ borderColor: 'var(--status-rejected)', color: 'var(--status-rejected)' }}>
                  Delete
                </button>
              </div>
            ))}

            {adding && (
              <div className="grid grid-cols-2 gap-2 border border-dashed border-border-strong p-3 sm:grid-cols-7 sm:items-end">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <AdminLabel>Name</AdminLabel>
                  <Input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} className="h-9" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Gender</AdminLabel>
                  <Select value={newCategory.gender} onValueChange={(v) => setNewCategory({ ...newCategory, gender: (v ?? 'male') as Gender })} items={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}>
                    <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Min age</AdminLabel>
                  <Input type="number" value={newCategory.min_age} onChange={(e) => setNewCategory({ ...newCategory, min_age: Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Max age</AdminLabel>
                  <Input type="number" placeholder="none" value={newCategory.max_age} onChange={(e) => setNewCategory({ ...newCategory, max_age: e.target.value === '' ? '' : Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Fee</AdminLabel>
                  <Input type="number" value={newCategory.fee} onChange={(e) => setNewCategory({ ...newCategory, fee: Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <AdminLabel>Max slots</AdminLabel>
                  <Input type="number" placeholder="∞" value={newCategory.max_slots} onChange={(e) => setNewCategory({ ...newCategory, max_slots: e.target.value === '' ? '' : Number(e.target.value) })} className="h-9 font-mono" />
                </div>
                <button type="button" onClick={addCategory} disabled={savingCategory} className="h-9 bg-accent font-heading text-[10px] font-semibold tracking-[0.12em] text-accent-foreground uppercase disabled:opacity-50">
                  {savingCategory ? '…' : 'Add'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
