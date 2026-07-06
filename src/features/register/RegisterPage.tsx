import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { StepProgress } from '@/components/brand/StepProgress'
import { RunBikeRunStrip } from '@/components/brand/RunBikeRunStrip'
import { BrandLoader } from '@/components/brand/BrandLoader'
import { ClosedScreen } from './ClosedScreen'
import { SuccessScreen } from './SuccessScreen'
import { Step1Eligibility } from './steps/Step1Eligibility'
import { Step2Personal } from './steps/Step2Personal'
import { Step3Payment } from './steps/Step3Payment'
import { Step4Review } from './steps/Step4Review'
import { EMPTY_FORM, isFormDirty, matchCategory, type RegisterFormState } from './formState'
import { formatDate, isSamePhone, isValidBdPhone, isValidEmail, isValidFullName, isValidTransactionId, normalizePhone, toTitleCase } from '@/lib/format'
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
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
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
    try {
      localStorage.setItem(draftKey, JSON.stringify(form))
    } catch {
      // storage unavailable/full — draft persistence is best-effort
    }
  }, [draftKey, form])

  function clearDraft() {
    if (!draftKey) return
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // storage unavailable — nothing to clean up
    }
  }

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <BrandLoader />
      </div>
    )
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
      clearDraft()
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
      clearDraft()
      setResult(res)
    } else {
      setSubmitError(REGISTER_ERROR_MESSAGES[res.error] ?? 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।')
    }
  }

  function goNext() {
    setDirection('forward')
    setStep((s) => s + 1)
  }
  function goBack() {
    setDirection('back')
    setStep((s) => s - 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl flex-col lg:min-h-screen lg:flex-row">
        <div
          className="reg-poster-panel flex h-48 shrink-0 flex-col justify-between p-5 sm:h-64 lg:h-auto lg:w-[40%] lg:p-10"
          style={{ backgroundImage: "url('/assets/poster.jpg')" }}
        >
          <a href={TRIATHLON_BANGLADESH_URL} target="_blank" rel="noopener noreferrer" className="relative z-10 flex items-center gap-2">
            <img src="/assets/triathlon-bd-shield-white.png" alt="Triathlon Bangladesh" className="h-10 w-auto lg:h-12" />
          </a>
          <div className="relative z-10 space-y-1 lg:mt-auto lg:space-y-2">
            <h2 className="font-heading text-lg uppercase tracking-[0.1em] text-foreground lg:text-2xl">{event.name}</h2>
            <p className="text-xs text-muted-foreground lg:text-sm">
              {formatDate(event.event_date)} &middot; {event.venue}
            </p>
            <a
              href={TRIATHLON_BANGLADESH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-accent underline underline-offset-2"
            >
              triathlonbangladesh.com ↗
            </a>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-lg space-y-6">
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

            <div className="wizard-shell p-5 sm:p-6">
              <div key={step} className={direction === 'forward' ? 'animate-step-in-forward' : 'animate-step-in-back'}>
                {step === 1 && <Step1Eligibility event={event} categories={categories} form={form} setField={setField} />}
                {step === 2 && <Step2Personal jerseyChart={event.jersey_chart} form={form} setField={setField} />}
                {step === 3 && <Step3Payment event={event} category={category} form={form} setField={setField} />}
                {step === 4 && <Step4Review event={event} category={category} form={form} setField={setField} />}
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-center text-sm font-medium text-foreground">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <Button type="button" variant="outline" className="h-12 flex-1 transition-transform hover:-translate-y-px" onClick={goBack}>
                  পূর্ববর্তী
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button
                  type="button"
                  className="btn-sheen h-12 flex-1 bg-primary text-primary-foreground transition-transform hover:-translate-y-px hover:bg-primary/90"
                  disabled={!stepValid[step]}
                  onClick={goNext}
                >
                  পরবর্তী
                </Button>
              ) : (
                <Button
                  type="button"
                  className="btn-sheen h-12 flex-1 bg-primary text-primary-foreground transition-transform hover:-translate-y-px hover:bg-primary/90"
                  disabled={!stepValid[4] || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? <BrandLoader inline label="সাবমিট হচ্ছে..." /> : 'সাবমিট করুন'}
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
      </div>
    </div>
  )
}
