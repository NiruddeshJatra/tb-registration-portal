import { TapTileGroup } from '@/components/brand/TapTile'
import { DateOfBirthPicker } from '@/components/brand/DateOfBirthPicker'
import { FieldError, FieldLabel } from './fields'
import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import type { StepFieldProps } from '../RegisterPage'
import { distinctCategoryNames, resolveCategory } from '../formState'
import { calculateAge, formatTaka } from '@/lib/format'

interface Props extends StepFieldProps {
  event: EventRow
  categories: CategoryRow[]
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step1Eligibility({ event, categories, form, setField, touched, markTouched, clearTouched }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const manualSelect = event.manual_category_select
  const distances = manualSelect ? distinctCategoryNames(categories) : []
  const category = resolveCategory(event, categories, form)
  // Auto-match events warn when no category fits the age/gender. Manual-select
  // events can't "not match" — the athlete simply hasn't picked a distance yet.
  const showNoMatch = Boolean(!manualSelect && form.gender && form.date_of_birth && !category)
  const dobValid = Boolean(form.date_of_birth)
  const dobError = Boolean(touched.dob) && !dobValid
  const age = category && form.date_of_birth ? calculateAge(form.date_of_birth, event.event_date) : null

  return (
    <>
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-[0.02em] uppercase">Eligibility</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground" lang="bn">
          {manualSelect
            ? 'লিঙ্গ, জন্ম তারিখ ও আপনার দূরত্ব বেছে নিন — ফি দেখানো হবে।'
            : 'লিঙ্গ ও জন্ম তারিখ দিন — আপনার ক্যাটাগরি ও ফি স্বয়ংক্রিয়ভাবে দেখানো হবে।'}
        </p>
      </div>

      <TapTileGroup
        name="gender"
        label="Gender"
        gloss="লিঙ্গ"
        value={form.gender}
        onChange={(v) => setField('gender', v as RegisterFormState['gender'])}
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ]}
      />

      <div className="flex flex-col gap-2.5">
        <FieldLabel htmlFor="dob" gloss="জন্ম তারিখ">Date of birth</FieldLabel>
        <DateOfBirthPicker
          id="dob"
          value={form.date_of_birth}
          onChange={(iso) => setField('date_of_birth', iso)}
          max={today}
          onBlur={() => markTouched('dob')}
          onFocus={() => clearTouched('dob')}
          invalid={dobError}
          valid={dobValid}
        />
        <FieldError show={dobError}>সঠিক জন্ম তারিখ দিন (dd/mm/yyyy)</FieldError>
      </div>

      {manualSelect && distances.length > 0 && (
        <TapTileGroup
          name="category_name"
          label="Distance"
          gloss="দূরত্ব"
          value={form.category_name}
          onChange={(v) => setField('category_name', v)}
          options={distances.map((d) => ({ value: d, label: d }))}
        />
      )}

      {category && (
        <div className="animate-rise flex items-center justify-between gap-3 border-[1.5px] border-border-strong bg-accent p-4">
          <div>
            <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-foreground uppercase">Your category</p>
            <p className="mt-0.5 font-heading text-[19px] font-semibold tracking-[0.02em] text-foreground uppercase">{category.name}</p>
            {!manualSelect && age !== null && (
              <p className="mt-0.5 text-[11.5px] text-foreground/75" lang="bn">
                বয়স {age} · ইভেন্টের দিন অনুযায়ী
              </p>
            )}
          </div>
          <p className="font-mono text-[22px] font-semibold whitespace-nowrap text-foreground">{formatTaka(category.fee)}</p>
        </div>
      )}

      {showNoMatch && (
        <div className="animate-rise border-[1.5px] border-destructive bg-destructive/[0.06] p-4">
          <p className="text-[13px] font-medium text-destructive" lang="bn">দুঃখিত, আপনার বয়স/লিঙ্গের জন্য কোনো উপযুক্ত ক্যাটাগরি নেই।</p>
          <p className="mt-1 text-xs text-muted-foreground">No eligible category matches your age/gender for this event.</p>
        </div>
      )}
    </>
  )
}
