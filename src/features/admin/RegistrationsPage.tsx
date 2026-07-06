import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { RegistrationDetailDrawer } from './RegistrationDetailDrawer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BrandLoader } from '@/components/brand/BrandLoader'
import { cn } from '@/lib/utils'
import type { CategoryRow, RegistrationRow, RegistrationStatus } from '@/lib/types'

const STATUS_CHIP_CLASS: Record<RegistrationStatus, string> = {
  pending: 'status-chip status-chip-pending',
  approved: 'status-chip status-chip-approved',
  rejected: 'status-chip status-chip-rejected',
  cancelled: 'status-chip status-chip-cancelled',
}

const PAGE_SIZE = 50
const ALL = '__all__'

type Row = RegistrationRow & { categories?: { name: string; fee: number } | null }

export function RegistrationsPage() {
  const { events, selectedEventId, setSelectedEventId, loading: eventsLoading } = useEvents()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [roleFilter, setRoleFilter] = useState(ALL)
  const [sourceFilter, setSourceFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [sizeFilter, setSizeFilter] = useState(ALL)
  const [selected, setSelected] = useState<Row | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!selectedEventId) return
    supabase
      .from('categories')
      .select('*')
      .eq('event_id', selectedEventId)
      .order('display_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [selectedEventId])

  useEffect(() => {
    setPage(0)
  }, [selectedEventId, search, categoryFilter, statusFilter, roleFilter, sourceFilter, typeFilter, sizeFilter])

  useEffect(() => {
    if (!selectedEventId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      let query = supabase
        .from('registrations')
        .select('*, categories(name, fee)', { count: 'exact' })
        .eq('event_id', selectedEventId)

      if (categoryFilter !== ALL) query = query.eq('category_id', categoryFilter)
      if (statusFilter !== ALL) query = query.eq('status', statusFilter)
      if (roleFilter !== ALL) query = query.eq('participant_role', roleFilter)
      if (sourceFilter !== ALL) query = query.eq('entry_source', sourceFilter)
      if (typeFilter !== ALL) query = query.eq('registration_type', typeFilter)
      if (sizeFilter !== ALL) query = query.eq('jersey_size', sizeFilter)
      if (search.trim()) {
        const q = search.trim()
        query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,transaction_id.ilike.%${q}%,ref_code.ilike.%${q}%`)
      }

      query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      const { data, count: total } = await query
      if (cancelled) return
      setRows((data as Row[]) ?? [])
      setCount(total ?? 0)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedEventId, page, search, categoryFilter, statusFilter, roleFilter, sourceFilter, typeFilter, sizeFilter, reloadKey])

  function refresh() {
    setSelected(null)
    setReloadKey((k) => k + 1)
  }

  if (eventsLoading) return <BrandLoader />
  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="admin-page-header">
        <h1>Registrations</h1>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      <Input
        placeholder="Search name, phone, TxID, ref code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 w-full sm:w-64"
      />

      <div className="flex flex-wrap gap-2">
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? ALL)}
          items={[{ value: ALL, label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        >
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? ALL)}
          items={[
            { value: ALL, label: 'All Status' },
            ...['pending', 'approved', 'rejected', 'cancelled'].map((s) => ({ value: s, label: s })),
          ]}
        >
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Status</SelectItem>
            {['pending', 'approved', 'rejected', 'cancelled'].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v ?? ALL)}
          items={[
            { value: ALL, label: 'All Roles' },
            ...['runner', 'organizer', 'crew', 'mentor', 'ambassador', 'guest', 'pacer', 'volunteer'].map((r) => ({ value: r, label: r })),
          ]}
        >
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Roles</SelectItem>
            {['runner', 'organizer', 'crew', 'mentor', 'ambassador', 'guest', 'pacer', 'volunteer'].map((r) => (
              <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v ?? ALL)}
          items={[
            { value: ALL, label: 'All Sources' },
            ...['self', 'admin_manual', 'group_import'].map((s) => ({ value: s, label: s })),
          ]}
        >
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sources</SelectItem>
            {['self', 'admin_manual', 'group_import'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v ?? ALL)}
          items={[
            { value: ALL, label: 'All Types' },
            ...['paid', 'discounted', 'complimentary'].map((t) => ({ value: t, label: t })),
          ]}
        >
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Types</SelectItem>
            {['paid', 'discounted', 'complimentary'].map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sizeFilter}
          onValueChange={(v) => setSizeFilter(v ?? ALL)}
          items={[{ value: ALL, label: 'All Sizes' }, ...['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => ({ value: s, label: s }))]}
        >
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sizes</SelectItem>
            {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="admin-table max-h-[70vh] overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Jersey</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>TxID</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center">
                  <BrandLoader inline />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  {count === 0 ? (
                    <div className="space-y-1">
                      <p>এখনও কোনো registration নেই</p>
                      <p className="text-sm">No registrations yet for this event.</p>
                    </div>
                  ) : (
                    'No registrations match these filters.'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell className="font-medium">{r.ref_code}</TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell>{r.categories?.name ?? '—'}</TableCell>
                  <TableCell>{r.jersey_size}</TableCell>
                  <TableCell className="capitalize">{r.participant_role}</TableCell>
                  <TableCell className="capitalize">{r.registration_type}</TableCell>
                  <TableCell>
                    <span className={cn(STATUS_CHIP_CLASS[r.status])}>{r.status}</span>
                  </TableCell>
                  <TableCell>{r.transaction_id}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm tabular-nums text-muted-foreground">
          {count} total &middot; Page {page + 1} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <RegistrationDetailDrawer registration={selected} onClose={() => setSelected(null)} onUpdated={refresh} />
    </div>
  )
}
