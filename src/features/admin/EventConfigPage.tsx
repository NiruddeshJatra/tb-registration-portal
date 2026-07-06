import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandLoader } from '@/components/brand/BrandLoader'
import type { CategoryRow, Gender } from '@/lib/types'

const emptyDraft = { name: '', gender: 'male' as Gender, min_age: 18, max_age: '' as number | '', fee: 0, max_slots: '' as number | '', display_order: 0 }

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
    loadCategories()
  }

  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Event Config</h1>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Event Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2">
            <Checkbox checked={registrationOpen} onCheckedChange={(v) => setRegistrationOpen(v === true)} />
            <span>Registration Open</span>
          </label>
          <div className="space-y-2">
            <Label>Registration Deadline</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Max Total Slots (across all categories)</Label>
            <Input
              type="number"
              placeholder="unlimited"
              value={maxTotalSlots}
              onChange={(e) => setMaxTotalSlots(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Number</Label>
            <Input value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fee Note</Label>
            <Textarea value={feeNote} onChange={(e) => setFeeNote(e.target.value)} rows={3} />
          </div>
          <Button onClick={saveEvent} disabled={savingEvent} className="btn-sheen">
            {savingEvent ? <BrandLoader inline label="Saving..." /> : 'Save Event Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.map((c) => (
            <div key={c.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-7 sm:items-end">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && updateCategory(c.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <Select defaultValue={c.gender} onValueChange={(v) => updateCategory(c.id, { gender: v as Gender })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Age</Label>
                <Input type="number" defaultValue={c.min_age} onBlur={(e) => updateCategory(c.id, { min_age: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Age</Label>
                <Input
                  type="number"
                  defaultValue={c.max_age ?? ''}
                  placeholder="none"
                  onBlur={(e) => updateCategory(c.id, { max_age: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fee</Label>
                <Input type="number" defaultValue={c.fee} onBlur={(e) => updateCategory(c.id, { fee: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Slots</Label>
                <Input
                  type="number"
                  defaultValue={c.max_slots ?? ''}
                  placeholder="unlimited"
                  onBlur={(e) => updateCategory(c.id, { max_slots: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <Button variant="destructive" size="sm" onClick={() => deleteCategory(c.id)}>
                Delete
              </Button>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-7 sm:items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gender</Label>
              <Select value={newCategory.gender} onValueChange={(v) => setNewCategory({ ...newCategory, gender: v as Gender })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Age</Label>
              <Input
                type="number"
                value={newCategory.min_age}
                onChange={(e) => setNewCategory({ ...newCategory, min_age: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Age</Label>
              <Input
                type="number"
                placeholder="none"
                value={newCategory.max_age}
                onChange={(e) => setNewCategory({ ...newCategory, max_age: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fee</Label>
              <Input type="number" value={newCategory.fee} onChange={(e) => setNewCategory({ ...newCategory, fee: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Slots</Label>
              <Input
                type="number"
                placeholder="unlimited"
                value={newCategory.max_slots}
                onChange={(e) => setNewCategory({ ...newCategory, max_slots: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <Button size="sm" onClick={addCategory} disabled={savingCategory} className="btn-sheen">
              {savingCategory ? <BrandLoader inline label="Adding..." /> : 'Add'}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
