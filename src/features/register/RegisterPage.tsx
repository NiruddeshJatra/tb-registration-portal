import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { StepProgress } from '@/components/brand/StepProgress'
import { RunBikeRunStrip } from '@/components/brand/RunBikeRunStrip'
import { ClosedScreen } from './ClosedScreen'
import { SuccessScreen } from './SuccessScreen'
import { Step1Eligibility } from './steps/Step1Eligibility'
import { Step2Personal } from './steps/Step2Personal'
import { Step3Payment } from './steps/Step3Payment'
import { Step4Review } from './steps/Step4Review'
import { EMPTY_FORM, isFormDirty, matchCategory, type RegisterFormState } from './formState'
import { isSamePhone, isValidBdPhone, isValidEmail, isValidFullName, isValidTransactionId, normalizePhone, toTitleCase } from '@/lib/format'
import { REGISTER_ERROR_MESSAGES } from '@/lib/errorMessages'
import { TRIATHLON_BANGLADESH_URL } from '@/lib/constants'
import type { CategoryRow, EventRow, RegisterParticipantResult } from '@/lib/types'

const TOTAL_STEPS = 4

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'closed'; reason: string }
  | { status: 'ready'; event: EventRow; categories: CategoryRow[] }

export function RegisterPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterParticipantResult & { ok: true } | null>(null)
  const [showRestored, setShowRestored] = useState(false)

  const draftKey = eventSlug ? `tb-reg-draft:${eventSlug}` : null

  useEffect(() => {
    if (!draftKey) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        setForm(JSON.parse(raw) as RegisterFormState)
        setShowRestored(true)
      }
    } catch {
      // corrupt or inaccessible draft — ignore
    }
    // Restore only once per mount, keyed on the event slug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || !isFormDirty(form)) return
    localStorage.setItem(draftKey, JSON.stringify(form))
  }, [draftKey, form])

  useEffect(() => {
    let cancelled = false
    async function fetchEvent() {
      const { data: event } = await supabase.from('events').select('*').eq('slug', eventSlug).maybeSingle()
      if (cancelled) return
      if (!event) {
        setLoad({ status: 'not_found' })
        return
      }
      if (!event.registration_open) {
        setLoad({ status: 'closed', reason: 'এই ইভেন্টের জন্য রেজিস্ট্রেশন এখনো খোলা হয়নি অথবা বন্ধ হয়ে গেছে।' })
        return
      }
      if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
        setLoad({ status: 'closed', reason: 'রেজিস্ট্রেশনের সময়সীমা শেষ হয়ে গেছে।' })
        return
      }
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('event_id', event.id)
        .order('display_order')
      setLoad({ status: 'ready', event, categories: categories ?? [] })
    }
    fetchEvent()
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isFormDirty(form) && !result) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form, result])

  if (load.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">লোড হচ্ছে...</div>
  }
  if (load.status === 'not_found') {
    return <ClosedScreen message="ইভেন্ট পাওয়া যায়নি।" />
  }
  if (load.status === 'closed') {
    return <ClosedScreen message={load.reason} />
  }

  const { event, categories } = load

  if (result) {
    return <SuccessScreen refCode={result.ref_code} name={toTitleCase(form.full_name)} categoryName={result.category_name} fee={result.fee} />
  }

  const setField = <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const category = form.gender && form.date_of_birth ? matchCategory(categories, form.gender, form.date_of_birth, event.event_date) : null

  const stepValid: Record<number, boolean> = {
    1: Boolean(form.gender && form.date_of_birth && category),
    2: Boolean(
      isValidFullName(form.full_name) &&
        isValidBdPhone(form.phone) &&
        isValidBdPhone(form.emergency_phone) &&
        !isSamePhone(form.phone, form.emergency_phone) &&
        isValidEmail(form.email) &&
        form.blood_group &&
        form.jersey_size,
    ),
    3: Boolean(form.payment_method && isValidBdPhone(form.payment_sender) && isValidTransactionId(form.transaction_id)),
    4: form.consent,
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitError(null)

    // Honeypot tripped: silently fake-succeed without touching the backend.
    if (form.honeypot.trim() !== '') {
      if (draftKey) localStorage.removeItem(draftKey)
      setResult({
        ok: true,
        ref_code: `${event.short_code}-000000`,
        category_name: category?.name ?? '',
        fee: category?.fee ?? 0,
        status: 'pending',
      })
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('register_participant', {
      p_event_slug: event.slug,
      p_full_name: form.full_name,
      p_phone: normalizePhone(form.phone),
      p_email: form.email,
      p_gender: form.gender,
      p_date_of_birth: form.date_of_birth,
      p_blood_group: form.blood_group,
      p_jersey_size: form.jersey_size,
      p_address: form.address,
      p_emergency_phone: normalizePhone(form.emergency_phone),
      p_comments: form.comments || null,
      p_payment_method: form.payment_method,
      p_payment_sender: normalizePhone(form.payment_sender),
      p_transaction_id: form.transaction_id,
    })
    setSubmitting(false)

    if (error) {
      setSubmitError('একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।')
      return
    }

    const res = data as RegisterParticipantResult
    if (res.ok) {
      if (draftKey) localStorage.removeItem(draftKey)
      setResult(res)
    } else {
      setSubmitError(REGISTER_ERROR_MESSAGES[res.error] ?? 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।')
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <a href={TRIATHLON_BANGLADESH_URL} target="_blank" rel="noopener noreferrer" className="flex justify-center">
          <img src="/assets/triathlon-bd-shield-white.png" alt="Triathlon Bangladesh" className="h-16 w-auto" />
        </a>
        <RunBikeRunStrip />

        {showRestored && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent/10 p-3 text-sm text-foreground">
            <span>আগের অসম্পূর্ণ ফর্ম ফিরিয়ে আনা হয়েছে</span>
            <button type="button" onClick={() => setShowRestored(false)} className="text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
        )}

        <StepProgress step={step} total={TOTAL_STEPS} />

        <div key={step} className="animate-step-in">
          {step === 1 && <Step1Eligibility event={event} categories={categories} form={form} setField={setField} />}
          {step === 2 && <Step2Personal jerseyChart={event.jersey_chart} form={form} setField={setField} />}
          {step === 3 && <Step3Payment event={event} category={category} form={form} setField={setField} />}
          {step === 4 && <Step4Review event={event} category={category} form={form} setField={setField} />}
        </div>

        {submitError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-center text-sm font-medium text-foreground">
            {submitError}
          </div>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setStep((s) => s - 1)}>
              পূর্ববর্তী
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              className="h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!stepValid[step]}
              onClick={() => setStep((s) => s + 1)}
            >
              পরবর্তী
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!stepValid[4] || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'সাবমিট হচ্ছে...' : 'সাবমিট করুন'}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <a href={TRIATHLON_BANGLADESH_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Triathlon Bangladesh — triathlonbangladesh.com
          </a>
        </p>
      </div>
    </div>
  )
}
