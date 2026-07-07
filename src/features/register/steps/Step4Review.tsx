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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-foreground/25 py-[9px] last:border-0">
      <span className="self-center font-heading text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
      <span className={`text-right text-[13.5px] font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export function Step4Review({ event, category, form, setField }: Props) {
  const year = event.name.match(/\d{4}/)?.[0] ?? ''
  return (
    <>
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-[0.02em] uppercase">Review</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground" lang="bn">
          সব তথ্য মিলিয়ে দেখুন — সাবমিটের পর এটাই আপনার বিব হবে।
        </p>
      </div>

      {/* draft bib preview */}
      <div className="border-[1.5px] border-border-strong">
        <div className="flex items-baseline justify-between border-b-[1.5px] border-border-strong bg-accent px-[18px] py-3">
          <p className="font-heading text-sm font-bold tracking-[0.06em] text-foreground uppercase">{event.name.replace(/\s*\d{4}\s*$/, '')} {year}</p>
          <p className="font-mono text-[10px] tracking-[0.1em] text-foreground">DRAFT</p>
        </div>
        <div className="px-[18px] py-1.5">
          <Row label="Athlete" value={toTitleCase(form.full_name) || '—'} />
          <Row label="Category" value={category?.name ?? '—'} />
          <Row label="Phone" value={form.phone || '—'} mono />
          <Row label="Emergency" value={form.emergency_phone || '—'} mono />
          <Row label="Email" value={form.email || '—'} />
          <Row label="Blood group" value={form.blood_group || '—'} mono />
          <Row label="Jersey" value={form.jersey_size || '—'} />
          <Row label="Payment" value={form.payment_method ? `${form.payment_method} · ${form.transaction_id}` : '—'} mono />
          <div className="flex justify-between gap-4 py-[11px]">
            <span className="self-center font-heading text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Fee</span>
            <span className="font-mono text-[17px] font-semibold">{category ? formatTaka(category.fee) : '—'}</span>
          </div>
        </div>
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

      {/* consent — large tap target */}
      <button
        type="button"
        role="checkbox"
        aria-checked={form.consent}
        onClick={() => setField('consent', !form.consent)}
        className={`flex items-start gap-3.5 border-[1.5px] p-[18px] text-left transition-all ${
          form.consent ? 'border-border-strong bg-accent/[0.18]' : 'border-border bg-input'
        }`}
      >
        <span
          className={`mt-px inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center border-[1.5px] border-border-strong transition-colors ${
            form.consent ? 'bg-accent' : 'bg-input'
          }`}
        >
          {form.consent && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15180E" strokeWidth="3.5"><path d="M20 6L9 17l-5-5" /></svg>
          )}
        </span>
        <span className="text-[13px] leading-[1.75] text-foreground" lang="bn">{CONSENT_TEXT}</span>
      </button>
    </>
  )
}
