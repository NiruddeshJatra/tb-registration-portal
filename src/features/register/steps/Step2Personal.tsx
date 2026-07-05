import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JerseyChartTable } from '@/components/brand/JerseyChartTable'
import type { JerseyChartRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import { isValidBdPhone, isValidEmail, toTitleCase } from '@/lib/format'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const

interface Props {
  jerseyChart: JerseyChartRow[]
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step2Personal({ jerseyChart, form, setField }: Props) {
  const phoneTouched = form.phone.length > 0
  const emergencyTouched = form.emergency_phone.length > 0
  const emailTouched = form.email.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name (English) / পূর্ণ নাম</Label>
        <Input
          id="full_name"
          value={form.full_name}
          onChange={(e) => setField('full_name', e.target.value)}
          className="h-11"
          placeholder="Md. Rahim Uddin"
        />
        {form.full_name && <p className="text-sm text-muted-foreground">দেখাবে: {toTitleCase(form.full_name)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone / ফোন নম্বর</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          className="h-11"
          placeholder="01XXXXXXXXX"
        />
        {phoneTouched && !isValidBdPhone(form.phone) && (
          <p className="text-sm text-destructive">সঠিক ১১ ডিজিটের নম্বর দিন</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergency_phone">Emergency Phone / জরুরি যোগাযোগ নম্বর</Label>
        <Input
          id="emergency_phone"
          type="tel"
          inputMode="numeric"
          value={form.emergency_phone}
          onChange={(e) => setField('emergency_phone', e.target.value)}
          className="h-11"
          placeholder="01XXXXXXXXX"
        />
        {emergencyTouched && !isValidBdPhone(form.emergency_phone) && (
          <p className="text-sm text-destructive">সঠিক ১১ ডিজিটের নম্বর দিন</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          className="h-11"
          placeholder="you@example.com"
        />
        {emailTouched && !isValidEmail(form.email) && <p className="text-sm text-destructive">সঠিক ইমেইল দিন</p>}
      </div>

      <div className="space-y-2">
        <Label>Blood Group / রক্তের গ্রুপ</Label>
        <Select value={form.blood_group} onValueChange={(v) => setField('blood_group', v as RegisterFormState['blood_group'])}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Select blood group" />
          </SelectTrigger>
          <SelectContent>
            {BLOOD_GROUPS.map((bg) => (
              <SelectItem key={bg} value={bg}>
                {bg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address / ঠিকানা</Label>
        <Textarea id="address" value={form.address} onChange={(e) => setField('address', e.target.value)} />
      </div>

      <div className="space-y-3">
        <Label>Jersey Size / জার্সির মাপ</Label>
        <Select value={form.jersey_size} onValueChange={(v) => setField('jersey_size', v as RegisterFormState['jersey_size'])}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Select jersey size" />
          </SelectTrigger>
          <SelectContent>
            {JERSEY_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <JerseyChartTable chart={jerseyChart} />
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          প্রো জার্সি সাধারণ টি-শার্টের মতো ঢিলা নয় — চার্টের মাপ অনুযায়ী গায়ে ফিট হবে। মাপ দেখে সাইজ নির্বাচন করুন।
          <br />
          Pro jerseys fit true to the chart measurements — they are NOT loose like regular T-shirts.
        </p>
      </div>
    </div>
  )
}
