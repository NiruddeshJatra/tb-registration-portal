import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TapTileGroup } from '@/components/brand/TapTile'
import { FieldError, FieldLabel, StepIntro, inputBorder } from './fields'
import type { EventRow, JerseyChartRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import type { StepFieldProps } from '../RegisterPage'
import { isSamePhone, isValidBdPhone, isValidEmail, isValidFullName, toTitleCase } from '@/lib/format'
import { cn } from '@/lib/utils'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
const PHONE_ERROR = 'সঠিক ১১ ডিজিটের নম্বর দিন / Enter a valid 11-digit number'

interface Props extends StepFieldProps {
  event: EventRow
  jerseyChart: JerseyChartRow[]
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step2Personal({ event, jerseyChart, form, setField, touched, markTouched, clearTouched }: Props) {
  const [chartOpen, setChartOpen] = useState(false)

  const nameFilled = form.full_name.length > 0
  const phoneFilled = form.phone.length > 0
  const emFilled = form.emergency_phone.length > 0
  const emailFilled = form.email.length > 0
  const samePhone = phoneFilled && emFilled && isSamePhone(form.phone, form.emergency_phone)

  const nameErr = Boolean(touched.name) && nameFilled && !isValidFullName(form.full_name)
  const phoneErr = Boolean(touched.phone) && phoneFilled && !isValidBdPhone(form.phone)
  const emErr = Boolean(touched.emergency) && emFilled && (!isValidBdPhone(form.emergency_phone) || samePhone)
  const emailErr = Boolean(touched.email) && emailFilled && !isValidEmail(form.email)

  // Only bike events hand out a fitted pro jersey; everyone else gets a T-shirt.
  const proJersey = event.requires_bike_type

  return (
    <>
      <StepIntro
        title="Personal"
        gloss="ব্যক্তিগত তথ্য"
        bn="আপনার তথ্য দিন — রেস কিট ও যোগাযোগের জন্য ব্যবহার হবে।"
        en="Enter your details — used for your race kit and to contact you."
      />

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="full_name" gloss="পূর্ণ নাম (ইংরেজিতে)">Full name (English)</FieldLabel>
        <Input
          id="full_name"
          value={form.full_name}
          onChange={(e) => setField('full_name', e.target.value)}
          onBlur={() => markTouched('name')}
          onFocus={() => clearTouched('name')}
          className={cn('h-[50px]', inputBorder(nameErr, nameFilled && !nameErr))}
          placeholder="Md. Rahim Uddin"
        />
        {nameFilled && !nameErr && (
          <p className="text-xs text-muted-foreground" lang="bn">
            বিবে দেখাবে / On your bib:{' '}
            <span className="font-heading text-xs font-semibold tracking-[0.08em] text-foreground uppercase">{toTitleCase(form.full_name)}</span>
          </p>
        )}
        <FieldError show={nameErr}>নামে শুধু ইংরেজি অক্ষর ব্যবহার করুন / Use English letters only</FieldError>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2">
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="phone" gloss="ফোন">Phone</FieldLabel>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            onBlur={() => markTouched('phone')}
            onFocus={() => clearTouched('phone')}
            className={cn('h-[50px] font-mono', inputBorder(phoneErr, phoneFilled && !phoneErr))}
            placeholder="01XXXXXXXXX"
          />
          <FieldError show={phoneErr}>{PHONE_ERROR}</FieldError>
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="emergency_phone" gloss="জরুরি">Emergency phone</FieldLabel>
          <Input
            id="emergency_phone"
            type="tel"
            inputMode="numeric"
            value={form.emergency_phone}
            onChange={(e) => setField('emergency_phone', e.target.value)}
            onBlur={() => markTouched('emergency')}
            onFocus={() => clearTouched('emergency')}
            className={cn('h-[50px] font-mono', inputBorder(emErr, emFilled && !emErr))}
            placeholder="01XXXXXXXXX"
          />
          <FieldError show={emErr}>
            {samePhone ? 'Emergency নম্বর নিজের নম্বর থেকে আলাদা হতে হবে / Must differ from your own number' : PHONE_ERROR}
          </FieldError>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="email" gloss="ইমেইল">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          onBlur={() => markTouched('email')}
          onFocus={() => clearTouched('email')}
          className={cn('h-[50px]', inputBorder(emailErr, emailFilled && !emailErr))}
          placeholder="you@example.com"
        />
        <FieldError show={emailErr}>সঠিক ইমেইল ঠিকানা দিন / Enter a valid email address</FieldError>
      </div>

      <TapTileGroup
        name="blood_group"
        label="Blood group"
        gloss="রক্তের গ্রুপ"
        tileFont="mono"
        gridClassName="grid-cols-4 min-[400px]:grid-cols-8"
        value={form.blood_group}
        onChange={(v) => setField('blood_group', v as RegisterFormState['blood_group'])}
        options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
      />

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="address" gloss="ঠিকানা">Address</FieldLabel>
        <Textarea id="address" rows={2} value={form.address} onChange={(e) => setField('address', e.target.value)} />
      </div>

      {event.requires_bike_type && (
        <TapTileGroup
          name="bike_type"
          label="Bike type"
          gloss="সাইকেলের ধরন"
          value={form.bike_type}
          onChange={(v) => setField('bike_type', v as RegisterFormState['bike_type'])}
          options={[
            { value: 'MTB', label: 'MTB', gloss: 'মাউন্টেন বাইক' },
            { value: 'Road/TT', label: 'Road / TT', gloss: 'রোড / টিটি বাইক' },
          ]}
        />
      )}

      {event.offers_shuttle && (
        <>
          <TapTileGroup
            name="transport_mode"
            label="Shuttle bus or private car?"
            gloss="আপনি কি শাটল বাস সেবা গ্রহণ করবেন নাকি ব্যক্তিগত গাড়িতে আসবেন?"
            value={form.transport_mode}
            onChange={(v) => setField('transport_mode', v as RegisterFormState['transport_mode'])}
            options={[
              { value: 'private_car', label: 'Private car', gloss: 'ব্যক্তিগত গাড়ি' },
              { value: 'shuttle_bus', label: 'Shuttle bus', gloss: 'শাটল বাস' },
            ]}
          />
          {form.transport_mode === 'shuttle_bus' && (
            <div className="animate-rise">
              <TapTileGroup
                name="shuttle_point"
                label="Shuttle pickup point"
                gloss="আপনি শহরের কোন পয়েন্ট থেকে শাটল বাসে উঠবেন?"
                value={form.shuttle_point}
                onChange={(v) => setField('shuttle_point', v)}
                options={event.shuttle_points.map((p) => ({ value: p.en, label: p.en, gloss: p.bn }))}
              />
            </div>
          )}
        </>
      )}

      {event.collects_strava_link && (
        <div className="border-l-[3px] border-accent bg-accent/15 px-3.5 py-2.5">
          <p className="text-xs leading-[1.7] text-foreground" lang="bn">
            📍 Strava লিংক এখন দিতে হবে না — রান শেষ করার পর WhatsApp-এ পাঠাবেন। বিস্তারিত সময়সূচি পাশের “HOW IT WORKS” অংশে দেওয়া আছে।
            <br />
            <span className="font-sans text-[11.5px] text-muted-foreground">No Strava link needed now — send it on WhatsApp after your run. See “HOW IT WORKS” for the schedule.</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="sl-label">
            {proJersey ? 'Jersey size' : 'T-shirt size'}
            <span className="ml-1 font-sans text-[11px] font-normal tracking-normal text-muted-foreground normal-case" lang="bn">
              / {proJersey ? 'জার্সির মাপ' : 'টি-শার্টের মাপ'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setChartOpen((o) => !o)}
            className="font-mono text-[10px] font-semibold tracking-[0.08em] text-foreground uppercase underline underline-offset-[3px]"
          >
            {chartOpen ? 'Hide size chart −' : 'Size chart +'}
            <span className="font-sans font-normal tracking-normal normal-case" lang="bn"> / মাপের চার্ট</span>
          </button>
        </div>
        <TapTileGroup
          name="jersey_size"
          label=""
          gridClassName="grid-cols-4 min-[400px]:grid-cols-7"
          value={form.jersey_size}
          onChange={(v) => setField('jersey_size', v as RegisterFormState['jersey_size'])}
          options={JERSEY_SIZES.map((s) => ({ value: s, label: s }))}
        />

        {chartOpen && jerseyChart.length > 0 && (
          <div className="animate-rise border-[1.5px] border-border-strong">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-foreground text-background">
                  <th className="px-3.5 py-2 text-left font-heading text-[10px] font-semibold tracking-[0.2em] uppercase">Size / মাপ</th>
                  <th className="px-3.5 py-2 text-right font-heading text-[10px] font-semibold tracking-[0.2em] uppercase">Chest / বুক (in)</th>
                  <th className="px-3.5 py-2 text-right font-heading text-[10px] font-semibold tracking-[0.2em] uppercase">Length / লম্বা (in)</th>
                </tr>
              </thead>
              <tbody>
                {jerseyChart.map((row, i) => (
                  <tr
                    key={row.size}
                    className={cn(
                      'border-t border-foreground/15',
                      form.jersey_size === row.size ? 'bg-accent/35' : i % 2 ? 'bg-foreground/[0.03]' : '',
                    )}
                  >
                    <td className="px-3.5 py-1.5 font-heading text-[13px] font-semibold tracking-[0.06em]">{row.size}</td>
                    <td className="px-3.5 py-1.5 text-right font-mono">{row.chest}</td>
                    <td className="px-3.5 py-1.5 text-right font-mono">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {proJersey && (
        <div className="border-l-[3px] border-accent bg-accent/15 px-3.5 py-2.5">
          <p className="text-xs leading-[1.7] text-foreground" lang="bn">
            ⚠️ প্রো জার্সি সাধারণ টি-শার্টের মতো ঢিলা নয় — চার্টের মাপ অনুযায়ী গায়ে ফিট হবে।
            <br />
            <span className="font-sans text-[11.5px] text-muted-foreground">Pro jerseys fit true to the chart — NOT loose like regular T-shirts.</span>
          </p>
        </div>
        )}
      </div>
    </>
  )
}
