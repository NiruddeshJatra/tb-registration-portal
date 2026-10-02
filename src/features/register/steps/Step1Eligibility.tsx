import { useState } from 'react'
import { TapTileGroup } from '@/components/brand/TapTile'
import { DateOfBirthPicker } from '@/components/brand/DateOfBirthPicker'
import { DashLoader } from '@/components/brand/DashLoader'
import { FieldError, FieldLabel, StepIntro } from './fields'
import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import type { StepFieldProps } from '../RegisterPage'
import { distinctCategoryNames, needsIdDocument, resolveCategory } from '../formState'
import { calculateAge, formatTaka } from '@/lib/format'
import { ID_DOCUMENT_ACCEPT, ID_DOCUMENT_ERROR_MESSAGES, uploadIdDocument } from '@/lib/idDocument'

interface Props extends StepFieldProps {
  event: EventRow
  categories: CategoryRow[]
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step1Eligibility({ event, categories, form, setField, touched, markTouched, clearTouched }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
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
  const needsId = needsIdDocument(event, form.date_of_birth)

  // The photo uploads the moment it is picked; the form only keeps its path.
  async function handleIdFile(file: File | undefined) {
    if (!file) return
    setUploadError(null)
    setUploading(true)
    const res = await uploadIdDocument(event.slug, file)
    setUploading(false)
    if ('error' in res) {
      setUploadError(ID_DOCUMENT_ERROR_MESSAGES[res.error])
      return
    }
    setField('id_document_path', res.path)
  }

  return (
    <>
      <StepIntro
        title="Eligibility"
        gloss="যোগ্যতা"
        bn={
          manualSelect
            ? 'লিঙ্গ, জন্ম তারিখ ও আপনার দূরত্ব বেছে নিন — ফি দেখানো হবে।'
            : 'লিঙ্গ ও জন্ম তারিখ দিন — আপনার ক্যাটাগরি ও ফি স্বয়ংক্রিয়ভাবে দেখানো হবে।'
        }
        en={
          manualSelect
            ? 'Choose your gender, date of birth and distance — the fee will be shown.'
            : 'Enter your gender and date of birth — your category and fee are shown automatically.'
        }
      />

      <TapTileGroup
        name="gender"
        label="Gender"
        gloss="লিঙ্গ"
        value={form.gender}
        onChange={(v) => setField('gender', v as RegisterFormState['gender'])}
        options={[
          { value: 'male', label: 'Male', gloss: 'পুরুষ' },
          { value: 'female', label: 'Female', gloss: 'নারী' },
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
        <FieldError show={dobError}>সঠিক জন্ম তারিখ দিন (dd/mm/yyyy) / Enter a valid date of birth</FieldError>
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
            <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-foreground uppercase">
              Your category{' '}
              <span className="font-sans text-[11px] font-normal tracking-normal normal-case" lang="bn">/ আপনার ক্যাটাগরি</span>
            </p>
            <p className="mt-0.5 font-heading text-[19px] font-semibold tracking-[0.02em] text-foreground uppercase">{category.name}</p>
            {/* Shown wherever age decides the category: auto-match events and age-banded distances. */}
            {age !== null && (!manualSelect || event.id_doc_min_age !== null) && (
              <p className="mt-0.5 text-[11.5px] text-foreground/75" lang="bn">
                বয়স {age} · ইভেন্টের দিন অনুযায়ী / Age {age} on race day
              </p>
            )}
          </div>
          <p className="font-mono text-[22px] font-semibold whitespace-nowrap text-foreground">{formatTaka(category.fee)}</p>
        </div>
      )}

      {needsId && (
        <div className="animate-rise flex flex-col gap-2.5">
          <FieldLabel htmlFor="id_document" gloss="NID / পাসপোর্টের ছবি (বাধ্যতামূলক)">NID / passport photo (required)</FieldLabel>
          <p className="text-xs leading-[1.7] text-muted-foreground" lang="bn">
            ভেটেরান ({event.id_doc_min_age}+) ক্যাটাগরির বয়স যাচাইয়ের জন্য আপনার NID বা পাসপোর্টের পরিষ্কার একটি ছবি দিন।
            <br />
            Veteran ({event.id_doc_min_age}+) entries need a clear photo of your NID or passport so the organisers can verify your age.
          </p>
          <label
            htmlFor="id_document"
            className={`sl-tile min-h-[54px] px-4 text-center font-heading text-[13px] font-semibold tracking-[0.1em] uppercase ${uploading ? 'pointer-events-none' : ''}`}
            style={form.id_document_path && !uploading ? { background: 'var(--accent)', borderColor: 'var(--border-strong)' } : undefined}
          >
            {uploading ? (
              <DashLoader inline label="আপলোড হচ্ছে… / Uploading…" />
            ) : (
              <span>
                {form.id_document_path ? '✓ Photo uploaded' : 'Choose photo'}{' '}
                <span className="font-sans text-xs font-normal tracking-normal normal-case" lang="bn">
                  / {form.id_document_path ? 'ছবি আপলোড হয়েছে — বদলাতে ট্যাপ করুন' : 'ছবি বেছে নিন'}
                </span>
              </span>
            )}
            <input
              id="id_document"
              type="file"
              accept={ID_DOCUMENT_ACCEPT}
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                handleIdFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <p className="text-[11.5px] text-muted-foreground" lang="bn">JPG, PNG বা WebP · শুধু আয়োজকরা দেখতে পাবেন / JPG, PNG or WebP · visible to the organisers only</p>
          <FieldError show={Boolean(uploadError)}>{uploadError}</FieldError>
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
