import { Fragment, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { RouteProgress } from '@/components/brand/RouteProgress'
import { DashLoader } from '@/components/brand/DashLoader'
import { ClosedScreen } from './ClosedScreen'
import { SuccessScreen } from './SuccessScreen'
import { Step1Eligibility } from './steps/Step1Eligibility'
import { Step2Personal } from './steps/Step2Personal'
import { Step3Payment } from './steps/Step3Payment'
import { Step4Review } from './steps/Step4Review'
import { EMPTY_FORM, distinctCategoryNames, isFormDirty, resolveCategory, type RegisterFormState } from './formState'
import { formatDate, isSamePhone, isValidBdPhone, isValidEmail, isValidFullName, isValidTransactionId, normalizePhone, toTitleCase } from '@/lib/format'
import { REGISTER_ERROR_MESSAGES } from '@/lib/errorMessages'
import { TRIATHLON_BANGLADESH_URL } from '@/lib/constants'
import type { CategoryRow, EventRow, RegisterParticipantResult } from '@/lib/types'

const TOTAL_STEPS = 4

export type TouchKey =
  | 'dob' | 'name' | 'phone' | 'emergency' | 'email' | 'sender' | 'txid'

export interface StepFieldProps {
  touched: Partial<Record<TouchKey, boolean>>
  markTouched: (key: TouchKey) => void
  clearTouched: (key: TouchKey) => void
}

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
  const [touched, setTouched] = useState<Partial<Record<TouchKey, boolean>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<(RegisterParticipantResult & { ok: true }) | null>(null)
  const [showRestored, setShowRestored] = useState(false)
  const [claimedApproved, setClaimedApproved] = useState<number | null>(null)

  const draftKey = eventSlug ? `tb-reg-draft:${eventSlug}` : null

  useEffect(() => {
    if (!draftKey) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        // Merge over EMPTY_FORM: drafts saved before a field existed restore without it.
        setForm({ ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<RegisterFormState>) })
        setShowRestored(true)
      }
    } catch {
      // corrupt or inaccessible draft — ignore
    }
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
      // Real "slots claimed" = approved registrations, via a SECURITY DEFINER
      // RPC (anon has no direct read on the registrations table).
      supabase.rpc('public_event_slots', { p_event_slug: eventSlug }).then(({ data }) => {
        if (cancelled || !data) return
        const claimed = (data as { claimed?: number }).claimed
        if (typeof claimed === 'number') setClaimedApproved(claimed)
      })
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
      <div className="sl-paper flex min-h-screen items-center justify-center">
        <DashLoader label="লোড হচ্ছে…" />
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
    return (
      <SuccessScreen
        event={event}
        refCode={result.ref_code}
        name={toTitleCase(form.full_name)}
        categoryName={result.category_name}
        fee={result.fee}
      />
    )
  }

  const setField = <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const markTouched = (key: TouchKey) => setTouched((t) => ({ ...t, [key]: true }))
  const clearTouched = (key: TouchKey) => setTouched((t) => ({ ...t, [key]: false }))
  const touchProps: StepFieldProps = { touched, markTouched, clearTouched }

  // Manual-select events resolve the category from the picked distance + gender;
  // everything else keeps the age/gender auto-match.
  const category = resolveCategory(event, categories, form)

  const stepValid: Record<number, boolean> = {
    1: Boolean(form.gender && form.date_of_birth && category),
    2: Boolean(
      isValidFullName(form.full_name) &&
      isValidBdPhone(form.phone) &&
      isValidBdPhone(form.emergency_phone) &&
      !isSamePhone(form.phone, form.emergency_phone) &&
      isValidEmail(form.email) &&
      form.blood_group &&
      form.jersey_size &&
      // Bike type is mandatory wherever the event asks for it.
      (!event.requires_bike_type || form.bike_type !== ''),
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
      p_bike_type: form.bike_type || null,
      // Never collected on the public form: a virtual run's Strava link only
      // exists after the run. It arrives by WhatsApp and an admin records it.
      p_strava_link: null,
      // Only sent for manual_category_select events; null keeps the RPC on its
      // original age/gender auto-match path.
      p_category_id: event.manual_category_select ? category?.id ?? null : null,
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
    window.scrollTo(0, 0)
  }
  function goBack() {
    setDirection('back')
    setStep((s) => s - 1)
    window.scrollTo(0, 0)
  }

  // The duathlon's three legs are fixed copy; a virtual event has no legs, so
  // its strip is built from the distances the athlete can pick.
  const railSegments = event.is_virtual
    ? distinctCategoryNames(categories).map((name) => {
        const [, n = name, unit = ''] = /^(\d+)\s*(.*)$/.exec(name) ?? []
        return { n, unit, label: 'Run', hi: false }
      })
    : [
        { n: '10', unit: 'K', label: 'Run', hi: false },
        { n: '40', unit: 'K', label: 'Bike', hi: true },
        { n: '5', unit: 'K', label: 'Run', hi: false },
      ]

  const claimed = claimedApproved ?? event.reg_counter ?? 0
  const cap = event.max_total_slots
  const canNext = stepValid[step]

  return (
    <div className="sl-paper min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1060px] flex-wrap items-stretch">
        {/* ── identity rail ── */}
        <aside className="flex min-w-[300px] flex-[1_1_320px] flex-col bg-foreground px-9 pt-7 pb-6 text-background lg:max-w-[440px]">
          <a
            href={TRIATHLON_BANGLADESH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-3 transition-opacity hover:opacity-85"
          >
            <img src="/assets/triathlon-bd-shield-white.png" alt="Triathlon Bangladesh" className="h-[42px] w-auto" />
            <div>
              <p className="font-heading text-[13px] font-semibold tracking-[0.24em] uppercase">Triathlon</p>
              <p className="font-heading text-[13px] font-semibold tracking-[0.24em] text-accent uppercase">
                Bangladesh <span className="text-[10px] font-normal tracking-normal text-faint">↗</span>
              </p>
            </div>
          </a>

          <div className="mt-8">
            <p className="font-heading text-xs font-semibold tracking-[0.3em] text-faint uppercase">Chattogram</p>
            <h1 className="mt-0.5 font-heading text-[44px] leading-none font-bold tracking-[0.01em] text-background uppercase">
              {event.name.replace(/\s*\d{4}\s*$/, '')}
              <br />
              <span className="text-accent">{event.name.match(/\d{4}/)?.[0]}</span>
            </h1>
          </div>

          <div className="mt-8 flex items-stretch border-y border-background/20">
            {railSegments.map((s, i) => (
              <Fragment key={`${s.n}${s.unit}-${s.label}`}>
                {i > 0 && <div className="w-px bg-background/20" />}
                <div className="flex-1 py-3.5 text-center">
                  <p className={`font-heading text-[30px] leading-none font-bold ${s.hi ? 'text-accent' : ''}`}>
                    {s.n}
                    <span className="text-sm text-faint">{s.unit}</span>
                  </p>
                  <p className="mt-1 font-heading text-[9px] font-semibold tracking-[0.3em] text-faint uppercase">{s.label}</p>
                </div>
              </Fragment>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2 text-[13px]">
            {!event.is_virtual && (
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.08em] text-accent">DATE</span>
                <span className="text-background">{formatDate(event.event_date)}</span>
              </div>
            )}
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[10px] tracking-[0.08em] text-accent">VENUE</span>
              <span className="text-background">{event.venue}</span>
            </div>
            {event.requires_bike_type && (
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.08em] whitespace-nowrap text-accent">BIKE CHECK-IN</span>
                <span className="text-background">5 November, 2026</span>
              </div>
            )}
            {event.fee_note && (
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.08em] text-accent">FEE</span>
                <span className="text-background">{event.fee_note}</span>
              </div>
            )}
            {event.participation_note && (
              <div className="mt-1 border-l-2 border-accent pl-3">
                <p className="font-mono text-[10px] tracking-[0.08em] text-accent">HOW IT WORKS</p>
                <p className="mt-1 leading-[1.7] text-background" lang="bn">{event.participation_note}</p>
              </div>
            )}
          </div>

          <div className="mt-auto pt-6">
            {cap ? (
              <>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-heading text-[10px] font-semibold tracking-[0.26em] text-faint uppercase">Slots claimed</span>
                  <span className="font-mono text-[13px] font-semibold text-accent tabular-nums">
                    {claimed}
                    <span className="text-faint">/{cap}</span>
                  </span>
                </div>
                <div className="h-[5px] bg-background/15">
                  <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.round((claimed / cap) * 100))}%` }} />
                </div>
              </>
            ) : null}
            <p className="mt-3.5 text-[11px] text-faint">
              <a href={TRIATHLON_BANGLADESH_URL} target="_blank" rel="noopener noreferrer" className="text-faint underline underline-offset-[3px]">
                triathlonbangladesh.com ↗
              </a>
            </p>
          </div>
        </aside>

        {/* ── form column ── */}
        <div className="flex min-w-[320px] flex-[999_1_340px] flex-col justify-center px-4 py-7 sm:px-[clamp(16px,4vw,44px)]">
          <RouteProgress step={step} legs={event.is_virtual ? ['WARM-UP', 'MID-RACE', 'LAST KM'] : undefined} />

          {showRestored && (
            <div className="mb-4 flex items-center justify-between gap-3 border-[1.5px] border-border-strong bg-accent/15 p-3 text-sm text-foreground">
              <span lang="bn">আগের অসম্পূর্ণ ফর্ম ফিরিয়ে আনা হয়েছে</span>
              <button type="button" onClick={() => setShowRestored(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
          )}

          <div className="sl-card relative">
            <p className="pointer-events-none absolute -top-1.5 right-3.5 m-0 font-heading text-[92px] leading-none font-bold text-foreground/[0.06] select-none">
              0{step}
            </p>
            <div
              key={step}
              className={`flex flex-col gap-[22px] p-[clamp(20px,4vw,32px)] ${direction === 'forward' ? 'animate-step-fwd' : 'animate-step-back'}`}
            >
              {step === 1 && <Step1Eligibility event={event} categories={categories} form={form} setField={setField} {...touchProps} />}
              {step === 2 && <Step2Personal event={event} jerseyChart={event.jersey_chart} form={form} setField={setField} {...touchProps} />}
              {step === 3 && <Step3Payment event={event} category={category} form={form} setField={setField} {...touchProps} />}
              {step === 4 && <Step4Review event={event} category={category} form={form} setField={setField} />}
            </div>
          </div>

          {submitError && (
            <div className="mt-4 border-[1.5px] border-destructive bg-destructive/10 p-3 text-center text-sm font-medium text-foreground" lang="bn">
              {submitError}
            </div>
          )}

          {/* nav */}
          <div className="mt-[22px] flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="flex h-14 flex-1 items-center justify-center gap-2 border-[1.5px] border-border-strong bg-transparent font-heading text-sm font-semibold tracking-[0.16em] text-foreground uppercase transition-transform hover:-translate-x-px hover:-translate-y-px"
              >
                <span className="relative -top-px">←</span>
                <span className="font-sans text-sm font-medium tracking-normal normal-case" lang="bn">পূর্ববর্তী</span>
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className={`flex h-14 flex-[2] items-center justify-center gap-2.5 border-[1.5px] border-border-strong font-heading text-[15px] font-semibold tracking-[0.16em] uppercase transition-all ${canNext
                    ? 'bg-foreground text-accent shadow-[4px_4px_0_rgba(21,24,14,.9)] hover:-translate-x-px hover:-translate-y-px'
                    : 'cursor-not-allowed border-foreground/20 bg-foreground/[0.12] text-foreground/45'
                  }`}
              >
                <span className="font-sans text-[15px] font-medium tracking-normal normal-case" lang="bn">পরবর্তী</span>
                <span className="relative -top-px">→</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!stepValid[4] || submitting}
                className={`flex h-14 flex-[2] items-center justify-center gap-2.5 border-[1.5px] border-border-strong font-heading text-[15px] font-semibold tracking-[0.16em] uppercase transition-all ${stepValid[4] && !submitting
                    ? 'bg-accent text-foreground shadow-[4px_4px_0_rgba(21,24,14,.9)] hover:-translate-x-px hover:-translate-y-px'
                    : 'cursor-not-allowed border-foreground/20 bg-foreground/[0.12] text-foreground/45'
                  }`}
              >
                {submitting ? (
                  <DashLoader inline label="সাবমিট হচ্ছে…" />
                ) : (
                  <>
                    <span className="font-sans text-[15px] font-medium tracking-normal normal-case" lang="bn">সাবমিট করুন</span>
                    <span className="relative -top-px">✓</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Organised by{' '}
            <a href={TRIATHLON_BANGLADESH_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px]">
              Triathlon Bangladesh
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
