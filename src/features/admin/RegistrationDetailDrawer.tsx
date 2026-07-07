import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { formatTaka } from '@/lib/format'
import { STATUS_CHIP_CLASS } from '@/lib/statusChip'
import { cn } from '@/lib/utils'
import type { RegistrationRow, RegistrationStatus } from '@/lib/types'

interface Props {
  registration: (RegistrationRow & { categories?: { name: string; fee: number } | null }) | null
  onClose: () => void
  onUpdated: () => void
}

const STATUS_COLORS: Record<RegistrationStatus, string> = {
  pending: 'var(--status-pending)',
  approved: 'var(--status-approved)',
  rejected: 'var(--status-rejected)',
  cancelled: 'var(--status-cancelled)',
}
const STATUS_ORDER: RegistrationStatus[] = ['approved', 'pending', 'rejected', 'cancelled']

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 border-b border-card-2 py-2 last:border-0">
      <span className="text-[11px] text-faint">{label}</span>
      <span className={cn('text-right text-[12px] font-medium text-foreground', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-heading text-[9.5px] font-semibold tracking-[0.26em] text-faint uppercase">{title}</p>
      <div className="border border-border bg-card px-4 py-1">{children}</div>
    </div>
  )
}

export function RegistrationDetailDrawer({ registration, onClose, onUpdated }: Props) {
  const { session } = useAuth()
  const [adminComment, setAdminComment] = useState('')
  const [pendingStatus, setPendingStatus] = useState<RegistrationStatus | null>(null)
  const [saving, setSaving] = useState(false)

  if (!registration) return null
  const r = registration

  async function applyStatus(status: RegistrationStatus) {
    setSaving(true)
    await supabase
      .from('registrations')
      .update({
        status,
        managed_by: session?.user.email ?? null,
        status_changed_at: new Date().toISOString(),
        admin_comment: adminComment || r.admin_comment,
      })
      .eq('id', r.id)
    setSaving(false)
    setPendingStatus(null)
    onUpdated()
  }

  function handleStatusClick(status: RegistrationStatus) {
    if (status === r.status) return
    if (status === 'rejected' || status === 'cancelled') setPendingStatus(status)
    else applyStatus(status)
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent showCloseButton={false} className="w-[min(460px,100vw)] gap-0 bg-[#101308] p-0">
          {/* sticky header */}
          <div className="border-b border-border bg-card px-6 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[24px] tracking-[0.02em] text-accent">{r.ref_code ?? 'N/A'}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-faint hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <span className={STATUS_CHIP_CLASS[r.status]}>{r.status}</span>
              <span className="text-[13px]">{r.full_name}</span>
              <span className="font-mono text-[11px] text-faint">{r.categories?.name ?? ''}</span>
            </div>
          </div>

          {/* body */}
          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[18px]">
            <Section title="Athlete">
              <Field label="Name" value={r.full_name} />
              <Field label="Phone" value={r.phone} mono />
              <Field label="Emergency" value={r.emergency_phone} mono />
              <Field label="Email" value={r.email} />
              <Field label="Gender" value={r.gender} />
              <Field label="Date of birth" value={r.date_of_birth} mono />
              <Field label="Blood group" value={r.blood_group} mono />
              <Field label="Address" value={r.address} />
            </Section>

            <Section title="Race">
              <Field label="Category" value={r.categories?.name} />
              <Field label="Jersey size" value={r.jersey_size} />
              <Field label="Role" value={r.participant_role} />
              <Field label="Entry source" value={r.entry_source} />
              <Field label="Registration type" value={r.registration_type} />
              <Field label="Discount reason" value={r.discount_reason} />
              <Field label="Complimentary reason" value={r.complimentary_reason} />
              <Field label="Authorized by" value={r.authorized_by} />
              <Field label="Group" value={r.group_name} />
              {r.categories?.fee !== undefined && <Field label="Fee" value={formatTaka(r.categories.fee)} mono />}
            </Section>

            <Section title="Payment">
              <Field label="Method" value={r.payment_method} />
              <Field label="Sender" value={r.payment_sender} mono />
              <Field label="Transaction ID" value={r.transaction_id} mono />
              {r.amount_paid !== null && <Field label="Amount paid" value={formatTaka(r.amount_paid)} mono />}
              <Field label="Comments" value={r.comments} />
              <Field label="Managed by" value={r.managed_by} />
              <Field label="Created" value={new Date(r.created_at).toLocaleString('en-GB')} mono />
            </Section>

            <div>
              <p className="mb-2 font-heading text-[9.5px] font-semibold tracking-[0.26em] text-faint uppercase">Admin note</p>
              <Textarea
                rows={2}
                defaultValue={r.admin_comment ?? ''}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Optional note — saved with status changes…"
              />
            </div>
          </div>

          {/* actions */}
          <div className="border-t border-border bg-card px-6 pt-4 pb-5">
            <p className="mb-2.5 font-heading text-[9.5px] font-semibold tracking-[0.26em] text-faint uppercase">Set status</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_ORDER.map((s) => {
                const active = r.status === s
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={saving || active}
                    onClick={() => handleStatusClick(s)}
                    className="flex h-[42px] items-center justify-center gap-[7px] border font-heading text-[10.5px] font-semibold tracking-[0.16em] uppercase disabled:cursor-default"
                    style={{
                      borderColor: active ? STATUS_COLORS[s] : 'var(--border-strong)',
                      color: active ? STATUS_COLORS[s] : 'var(--muted-foreground)',
                      background: active ? `color-mix(in srgb, ${STATUS_COLORS[s]} 8%, transparent)` : 'transparent',
                    }}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                    {s}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 font-mono text-[10px] text-faint uppercase">
              Changes recorded against {session?.user.email ?? 'admin'} · reversible
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent showCloseButton={false} className="border-t-[3px] border-t-destructive">
          <DialogHeader>
            <DialogTitle className="capitalize">{pendingStatus} this registration?</DialogTitle>
            <DialogDescription>
              This marks <span className="font-mono text-accent">{r.ref_code ?? r.full_name}</span> as {pendingStatus}. Recorded with your
              email — reversible later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)} className="font-heading tracking-[0.16em] uppercase">
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={() => pendingStatus && applyStatus(pendingStatus)} className="font-heading tracking-[0.16em] uppercase">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
