import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { formatTaka } from '@/lib/format'
import { STATUS_CHIP_CLASS } from '@/lib/statusChip'
import type { RegistrationRow, RegistrationStatus } from '@/lib/types'

interface Props {
  registration: (RegistrationRow & { categories?: { name: string; fee: number } | null }) | null
  onClose: () => void
  onUpdated: () => void
}

const STATUS_OPTIONS: RegistrationStatus[] = ['pending', 'approved', 'rejected', 'cancelled']

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function RegistrationDetailDrawer({ registration, onClose, onUpdated }: Props) {
  const { session } = useAuth()
  const [adminComment, setAdminComment] = useState('')
  const [pendingStatus, setPendingStatus] = useState<RegistrationStatus | null>(null)
  const [saving, setSaving] = useState(false)

  if (!registration) return null

  async function applyStatus(status: RegistrationStatus) {
    setSaving(true)
    await supabase
      .from('registrations')
      .update({
        status,
        managed_by: session?.user.email ?? null,
        status_changed_at: new Date().toISOString(),
        admin_comment: adminComment || registration!.admin_comment,
      })
      .eq('id', registration!.id)
    setSaving(false)
    setPendingStatus(null)
    onUpdated()
  }

  function handleStatusClick(status: RegistrationStatus) {
    if (status === 'rejected' || status === 'cancelled') {
      setPendingStatus(status)
    } else {
      applyStatus(status)
    }
  }

  return (
    <>
      <Sheet open={Boolean(registration)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {registration.ref_code ?? 'N/A'}
              <span className={STATUS_CHIP_CLASS[registration.status]}>{registration.status}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            <div className="rounded-lg border border-border">
              <Field label="Name" value={registration.full_name} />
              <Field label="Phone" value={registration.phone} />
              <Field label="Emergency Phone" value={registration.emergency_phone} />
              <Field label="Email" value={registration.email} />
              <Field label="Gender" value={registration.gender} />
              <Field label="DOB" value={registration.date_of_birth} />
              <Field label="Blood Group" value={registration.blood_group} />
              <Field label="Jersey Size" value={registration.jersey_size} />
              <Field label="Address" value={registration.address} />
              <Field label="Category" value={registration.categories?.name} />
              <Field label="Role" value={registration.participant_role} />
              <Field label="Entry Source" value={registration.entry_source} />
              <Field label="Registration Type" value={registration.registration_type} />
              <Field label="Discount Reason" value={registration.discount_reason} />
              <Field label="Complimentary Reason" value={registration.complimentary_reason} />
              <Field label="Authorized By" value={registration.authorized_by} />
              <Field label="Group" value={registration.group_name} />
              <Field label="Payment Method" value={registration.payment_method} />
              <Field label="Payment Sender" value={registration.payment_sender} />
              <Field label="Transaction ID" value={registration.transaction_id} />
              <Field label="Comments" value={registration.comments} />
              <Field label="Managed By" value={registration.managed_by} />
              <Field label="Status Changed At" value={registration.status_changed_at} />
              <Field label="Created At" value={registration.created_at} />
              {registration.categories?.fee !== undefined && <Field label="Fee" value={formatTaka(registration.categories.fee)} />}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Admin Comment</label>
              <Textarea
                defaultValue={registration.admin_comment ?? ''}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Optional note..."
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Change Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={registration.status === s ? 'default' : 'outline'}
                    disabled={saving || registration.status === s}
                    onClick={() => handleStatusClick(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{pendingStatus} this registration?</DialogTitle>
            <DialogDescription>
              This will mark {registration.ref_code ?? registration.full_name} as {pendingStatus}. This action is recorded with your
              email and can be reversed later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={saving} onClick={() => pendingStatus && applyStatus(pendingStatus)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
