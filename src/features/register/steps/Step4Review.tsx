import { Checkbox } from '@/components/ui/checkbox'
import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import { formatTaka, toTitleCase } from '@/lib/format'

interface Props {
  event: EventRow
  category: CategoryRow | null
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

const CONSENT_TEXT =
  'I am physically and mentally fit. আমি সব শর্ত মেনে রেজিস্ট্রেশন করছি এবং এটাও মানছি যে আয়োজকদের সিদ্ধান্ত চূড়ান্ত।'

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export function Step4Review({ event, category, form, setField }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <Row label="Event" value={event.name} />
        <Row label="Category" value={category?.name ?? ''} />
        <Row label="Fee" value={category ? formatTaka(category.fee) : ''} />
        <Row label="Name" value={toTitleCase(form.full_name)} />
        <Row label="Phone" value={form.phone} />
        <Row label="Emergency Phone" value={form.emergency_phone} />
        <Row label="Email" value={form.email} />
        <Row label="Blood Group" value={form.blood_group} />
        <Row label="Jersey Size" value={form.jersey_size} />
        <Row label="Payment Method" value={form.payment_method} />
        <Row label="Transaction ID" value={form.transaction_id} />
      </div>

      {/* Honeypot: hidden from real users; bots that fill this get a fake success. */}
      <div className="relative h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <label htmlFor="company_website">Company Website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.honeypot}
          onChange={(e) => setField('honeypot', e.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <Checkbox
          checked={form.consent}
          onCheckedChange={(v) => setField('consent', v === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground">{CONSENT_TEXT}</span>
      </label>
    </div>
  )
}
