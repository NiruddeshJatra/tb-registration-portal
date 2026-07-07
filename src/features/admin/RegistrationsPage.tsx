import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { RegistrationDetailDrawer } from './RegistrationDetailDrawer'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { STATUS_CHIP_CLASS } from '@/lib/statusChip'
import type { CategoryRow, RegistrationRow, RegistrationStatus } from '@/lib/types'

const PAGE_SIZE = 50
const ALL = '__all__'
const STATUS_TABS: (RegistrationStatus | typeof ALL)[] = [ALL, 'pending', 'approved', 'rejected', 'cancelled']

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
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | typeof ALL>(ALL)
  const [roleFilter, setRoleFilter] = useState(ALL)
  const [sourceFilter, setSourceFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [sizeFilter, setSizeFilter] = useState(ALL)
  const [selected, setSelected] = useState<Row | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const filtersActive =
    search.trim() !== '' || [categoryFilter, statusFilter, roleFilter, sourceFilter, typeFilter, sizeFilter].some((f) => f !== ALL)

  function clearFilters() {
    setSearch('')
    setCategoryFilter(ALL)
    setStatusFilter(ALL)
    setRoleFilter(ALL)
    setSourceFilter(ALL)
    setTypeFilter(ALL)
    setSizeFilter(ALL)
  }

  useEffect(() => {
    if (!selectedEventId) return
    supabase.from('categories').select('*').eq('event_id', selectedEventId).order('display_order').then(({ data }) => setCategories(data ?? []))
  }, [selectedEventId])

  useEffect(() => {
    setPage(0)
  }, [selectedEventId, search, categoryFilter, statusFilter, roleFilter, sourceFilter, typeFilter, sizeFilter])

  useEffect(() => {
    if (!selectedEventId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      let query = supabase.from('registrations').select('*, categories(name, fee)', { count: 'exact' }).eq('event_id', selectedEventId)

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

  if (eventsLoading) return null
  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const dropdown = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    opts: { value: string; label: string }[],
    widthClass: string,
  ) => (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)} items={opts}>
      <SelectTrigger className={cn('h-9', widthClass)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value} className="capitalize">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="flex flex-col gap-3.5">
      <div className="admin-page-header">
        <h1>Registrations</h1>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2.5" className="absolute top-1/2 left-3 -translate-y-1/2">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <Input
            placeholder="Search name / phone / TxID / ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[300px] pl-9 text-[12.5px]"
          />
        </div>

        <div className="flex border border-border">
          {STATUS_TABS.map((s) => {
            const active = statusFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'border-r border-border px-3.5 py-2 font-heading text-[10px] font-semibold tracking-[0.16em] uppercase last:border-r-0',
                  active ? 'bg-accent text-accent-foreground' : 'text-faint hover:text-foreground',
                )}
              >
                {s === ALL ? 'All' : s}
              </button>
            )
          })}
        </div>

        {dropdown(categoryFilter, setCategoryFilter, 'Category', [{ value: ALL, label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))], 'w-40')}
        {dropdown(sizeFilter, setSizeFilter, 'Size', [{ value: ALL, label: 'All Sizes' }, ...['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => ({ value: s, label: s }))], 'w-28')}
        {dropdown(roleFilter, setRoleFilter, 'Role', [{ value: ALL, label: 'All Roles' }, ...['runner', 'organizer', 'crew', 'mentor', 'ambassador', 'guest', 'pacer', 'volunteer'].map((r) => ({ value: r, label: r }))], 'w-36')}
        {dropdown(sourceFilter, setSourceFilter, 'Source', [{ value: ALL, label: 'All Sources' }, ...['self', 'admin_manual', 'group_import'].map((s) => ({ value: s, label: s }))], 'w-36')}
        {dropdown(typeFilter, setTypeFilter, 'Type', [{ value: ALL, label: 'All Types' }, ...['paid', 'discounted', 'complimentary'].map((t) => ({ value: t, label: t }))], 'w-36')}

        <p className="ml-auto font-mono text-[11px] text-faint tabular-nums">{count} result{count === 1 ? '' : 's'}</p>
      </div>

      {/* table / states */}
      {loading ? (
        <div className="border border-border">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="sl-skeleton h-11 border-b border-card-2 last:border-b-0" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-border-strong p-14 text-center">
          {count === 0 && !filtersActive ? (
            <>
              <p className="font-heading text-[15px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Start list is empty</p>
              <p className="mt-2 text-[12.5px] text-faint" lang="bn">এখনও কোনো registration নেই — ফর্ম লিংক শেয়ার করুন।</p>
            </>
          ) : (
            <>
              <p className="font-heading text-[15px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">No matches</p>
              <p className="mt-2 text-[12.5px] text-faint" lang="bn">এই ফিল্টারে কোনো registration পাওয়া যায়নি — ফিল্টার বদলে দেখুন।</p>
              <button type="button" onClick={clearFilters} className="mt-4 border border-border-strong px-4 py-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-border">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead>Ref Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Jersey</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TxID</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="h-11 cursor-pointer"
                  data-state={selected?.id === r.id ? 'selected' : undefined}
                  style={r.status === 'pending' ? { borderLeft: '2px solid var(--status-pending)' } : undefined}
                  onClick={() => setSelected(r)}
                >
                  <TableCell className="font-mono text-[12px] text-accent">{r.ref_code}</TableCell>
                  <TableCell className="text-[12.5px]">{r.full_name}</TableCell>
                  <TableCell className="font-mono text-[11.5px] text-muted-foreground">{r.phone}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{r.categories?.name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-[11.5px]">{r.jersey_size}</TableCell>
                  <TableCell className="text-[11.5px] text-muted-foreground capitalize">{r.participant_role}</TableCell>
                  <TableCell>
                    <span className={STATUS_CHIP_CLASS[r.status]}>{r.status}</span>
                  </TableCell>
                  <TableCell className="font-mono text-[11.5px] text-muted-foreground">{r.transaction_id}</TableCell>
                  <TableCell className="font-mono text-[11px] text-faint">
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-faint uppercase">Page {page + 1}/{totalPages} · click a row for detail</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="border border-border px-3.5 py-2 font-heading text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase disabled:opacity-40 enabled:hover:text-foreground"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border border-border px-3.5 py-2 font-heading text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase disabled:opacity-40 enabled:hover:text-foreground"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <RegistrationDetailDrawer registration={selected} onClose={() => setSelected(null)} onUpdated={refresh} />
    </div>
  )
}
