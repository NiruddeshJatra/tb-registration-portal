import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DateOfBirthPicker } from '@/components/brand/DateOfBirthPicker'
import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import { matchCategory } from '../formState'
import { formatDate, formatTaka } from '@/lib/format'

interface Props {
  event: EventRow
  categories: CategoryRow[]
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step1Eligibility({ event, categories, form, setField }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const category =
    form.gender && form.date_of_birth ? matchCategory(categories, form.gender, form.date_of_birth, event.event_date) : null
  const showNoMatch = form.gender && form.date_of_birth && !category

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <h2 className="text-xl text-foreground">{event.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(event.event_date)} &middot; {event.venue}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Gender / লিঙ্গ</Label>
        <RadioGroup
          value={form.gender}
          onValueChange={(v) => setField('gender', v as RegisterFormState['gender'])}
          className="flex gap-4"
        >
          <label className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10">
            <RadioGroupItem value="male" id="gender-male" />
            Male
          </label>
          <label className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10">
            <RadioGroupItem value="female" id="gender-female" />
            Female
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dob">Date of Birth / জন্ম তারিখ</Label>
        <DateOfBirthPicker id="dob" value={form.date_of_birth} onChange={(iso) => setField('date_of_birth', iso)} max={today} />
      </div>

      {category && (
        <div className="rounded-lg border border-accent bg-accent/10 p-4 text-center">
          <p className="text-foreground">
            আপনার ক্যাটাগরি: <span className="font-semibold">{category.name}</span> — {formatTaka(category.fee)} টাকা
          </p>
        </div>
      )}

      {showNoMatch && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-center text-sm">
          <p className="text-foreground">দুঃখিত, আপনার বয়স/লিঙ্গের জন্য কোনো উপযুক্ত ক্যাটাগরি নেই।</p>
          <p className="mt-1 text-muted-foreground">Sorry, no eligible category matches your age/gender for this event.</p>
        </div>
      )}
    </div>
  )
}
