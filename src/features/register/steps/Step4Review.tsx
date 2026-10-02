import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import { needsIdDocument } from '../formState'
import { StepIntro } from './fields'
import { formatTaka, toTitleCase } from '@/lib/format'

interface Props {
  event: EventRow
  category: CategoryRow | null
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

const CONSENT_BN = 'আমি শারীরিক ও মানসিকভাবে সুস্থ। আমি সব শর্ত মেনে রেজিস্ট্রেশন করছি এবং এটাও মানছি যে আয়োজকদের সিদ্ধান্ত চূড়ান্ত।'
const CONSENT_EN = 'I am physically and mentally fit. I am registering in agreement with all the terms, and I accept that the decision of the organisers is final.'
// Added for athletes who uploaded an ID photo.
const ID_PRIVACY_BN = 'আমার NID/পাসপোর্টের ছবি শুধু বয়স যাচাইয়ের জন্য আয়োজকরা ব্যবহার করবেন এবং ইভেন্টের সব কার্যক্রম শেষ হলে মুছে ফেলা হবে।'
const ID_PRIVACY_EN = 'My NID/passport photo will be used by the organisers only to verify my age, and deleted once all event activities are complete.'

function Row({ label, gloss, value, mono }: { label: string; gloss: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-foreground/25 py-[9px] last:border-0">
      <span className="self-center font-heading text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {label}
        <span className="ml-1 font-sans text-[11px] font-normal tracking-normal normal-case" lang="bn">/ {gloss}</span>
      </span>
      <span className={`text-right text-[13.5px] font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export function Step4Review({ event, category, form, setField }: Props) {
  const year = event.name.match(/\d{4}/)?.[0] ?? ''
  const hasIdDocument = needsIdDocument(event, form.date_of_birth)
  const shuttlePointBn = event.shuttle_points.find((p) => p.en === form.shuttle_point)?.bn
  const transport =
    form.transport_mode === 'shuttle_bus'
      ? `Shuttle bus / শাটল বাস — ${form.shuttle_point}${shuttlePointBn ? ` / ${shuttlePointBn}` : ''}`
      : form.transport_mode === 'private_car'
        ? 'Private car / ব্যক্তিগত গাড়ি'
        : '—'
  return (
    <>
      <StepIntro
        title="Review"
        gloss="যাচাই"
        bn="সব তথ্য মিলিয়ে দেখুন — সাবমিটের পর এটাই আপনার বিব হবে।"
        en="Check every detail — this becomes your bib once you submit."
      />

      {/* draft bib preview */}
      <div className="border-[1.5px] border-border-strong">
        <div className="flex items-baseline justify-between border-b-[1.5px] border-border-strong bg-accent px-[18px] py-3">
          <p className="font-heading text-sm font-bold tracking-[0.06em] text-foreground uppercase">{event.name.replace(/\s*\d{4}\s*$/, '')} {year}</p>
          <p className="font-mono text-[10px] tracking-[0.1em] text-foreground">DRAFT</p>
        </div>
        <div className="px-[18px] py-1.5">
          <Row label="Athlete" gloss="নাম" value={toTitleCase(form.full_name) || '—'} />
          <Row label="Category" gloss="ক্যাটাগরি" value={category?.name ?? '—'} />
          <Row label="Phone" gloss="ফোন" value={form.phone || '—'} mono />
          <Row label="Emergency" gloss="জরুরি" value={form.emergency_phone || '—'} mono />
          <Row label="Email" gloss="ইমেইল" value={form.email || '—'} />
          <Row label="Gender" gloss="লিঙ্গ" value={form.gender === 'male' ? 'Male / পুরুষ' : form.gender === 'female' ? 'Female / নারী' : '—'} />
          <Row label="Address" gloss="ঠিকানা" value={form.address || '—'} />
          <Row label="Blood group" gloss="রক্তের গ্রুপ" value={form.blood_group || '—'} mono />
          {event.requires_bike_type ? (
            <Row label="Jersey" gloss="জার্সি" value={form.jersey_size || '—'} />
          ) : (
            <Row label="T-shirt" gloss="টি-শার্ট" value={form.jersey_size || '—'} />
          )}
          {event.offers_shuttle && <Row label="Transport" gloss="যাতায়াত" value={transport} />}
          {hasIdDocument && <Row label="NID / passport" gloss="পরিচয়পত্র" value={form.id_document_path ? '✓ Uploaded / আপলোড হয়েছে' : '—'} />}
          <Row label="Payment" gloss="পেমেন্ট" value={form.payment_method ? `${form.payment_method} · ${form.transaction_id}` : '—'} mono />
          <div className="flex justify-between gap-4 py-[11px]">
            <span className="self-center font-heading text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Fee
              <span className="ml-1 font-sans text-[11px] font-normal tracking-normal normal-case" lang="bn">/ ফি</span>
            </span>
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
        <span className="text-[13px] leading-[1.75] text-foreground">
          <span lang="bn">{CONSENT_BN}{hasIdDocument && ` ${ID_PRIVACY_BN}`}</span>
          <span className="mt-1.5 block text-[12.5px] text-muted-foreground">{CONSENT_EN}{hasIdDocument && ` ${ID_PRIVACY_EN}`}</span>
        </span>
      </button>
    </>
  )
}
