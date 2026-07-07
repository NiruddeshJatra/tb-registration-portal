import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Input } from '@/components/ui/input'
import { DateOfBirthPicker } from '@/components/brand/DateOfBirthPicker'
import { DashLoader } from '@/components/brand/DashLoader'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { matchCategory } from '@/features/register/formState'
import { isSamePhone, isValidBdPhone, isValidEmail, isValidFullName, isValidTransactionId, normalizePhone } from '@/lib/format'
import { REGISTER_ERROR_MESSAGES } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import type { CategoryRow, Gender, ParticipantRole, RegistrationType, EntrySource, JerseySize, BloodGroup, PaymentMethod } from '@/lib/types'

const ROLES: ParticipantRole[] = ['runner', 'organizer', 'crew', 'mentor', 'ambassador', 'guest', 'pacer', 'volunteer']
const PAYMENT_METHODS: PaymentMethod[] = ['bKash', 'Nagad', 'Rocket', 'Upay']
const AUTO = '__auto__'
const NA = '__na__'

type TKey = 'name' | 'phone' | 'emergency' | 'email' | 'txid' | 'sender'

function AdminLabel({ children }: { children: React.ReactNode }) {
  return <label className="font-heading text-[9.5px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">{children}</label>
}
function SectionCard({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <p className="border-b border-border px-5 py-3 font-heading text-[10px] font-semibold tracking-[0.26em] text-accent uppercase">
        {num} · {title}
      </p>
      <div className="grid gap-3.5 px-5 py-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">{children}</div>
    </div>
  )
}

export function ManualAddPage() {
  const { session } = useAuth()
  const { events, selectedEventId, setSelectedEventId, selectedEvent } = useEvents()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [categoryChoice, setCategoryChoice] = useState<string>(AUTO)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [dob, setDob] = useState('')
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('')
  const [jerseySize, setJerseySize] = useState<JerseySize | ''>('')
  const [address, setAddress] = useState('')
  const [comments, setComments] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [paymentSender, setPaymentSender] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [role, setRole] = useState<ParticipantRole>('runner')
  const [entrySource, setEntrySource] = useState<EntrySource>('admin_manual')
  const [registrationType, setRegistrationType] = useState<RegistrationType>('paid')
  const [discountReason, setDiscountReason] = useState('')
  const [complimentaryReason, setComplimentaryReason] = useState('')
  const [authorizedBy, setAuthorizedBy] = useState('')
  const [groupName, setGroupName] = useState('')
  const [amountPaid, setAmountPaid] = useState<number | ''>('')

  const [touched, setTouched] = useState<Partial<Record<TKey, boolean>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error'; text: string } | null>(null)
  const [added, setAdded] = useState<{ ref: string; name: string; status: string } | null>(null)

  const mark = (k: TKey) => setTouched((t) => ({ ...t, [k]: true }))
  const clear = (k: TKey) => setTouched((t) => ({ ...t, [k]: false }))

  useEffect(() => {
    if (session?.user.email) setAuthorizedBy(session.user.email)
  }, [session])

  useEffect(() => {
    if (!selectedEventId) return
    supabase.from('categories').select('*').eq('event_id', selectedEventId).order('display_order').then(({ data }) => setCategories(data ?? []))
  }, [selectedEventId])

  const autoCategory = gender && dob && selectedEvent ? matchCategory(categories, gender, dob, selectedEvent.event_date) : null
  const resolvedCategoryId = categoryChoice === AUTO ? autoCategory?.id ?? null : categoryChoice === NA ? null : categoryChoice
  const resolvedCategory = categories.find((c) => c.id === resolvedCategoryId) ?? null

  function parseAmount(raw: string): number | '' {
    const trimmed = raw.trim()
    if (trimmed === '') return ''
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : ''
  }

  const nameFilled = fullName.length > 0
  const phoneFilled = phone.length > 0
  const emFilled = emergencyPhone.length > 0
  const emailFilled = email.length > 0
  const txidFilled = transactionId.length > 0
  const txidRequired = !(registrationType === 'complimentary' && transactionId.trim() === '')
  const samePhone = phoneFilled && emFilled && isSamePhone(phone, emergencyPhone)

  const nameErr = Boolean(touched.name) && nameFilled && !isValidFullName(fullName)
  const phoneErr = Boolean(touched.phone) && phoneFilled && !isValidBdPhone(phone)
  const emErr = Boolean(touched.emergency) && emFilled && (!isValidBdPhone(emergencyPhone) || samePhone)
  const emailErr = Boolean(touched.email) && emailFilled && !isValidEmail(email)
  const txidErr = Boolean(touched.txid) && txidFilled && txidRequired && !isValidTransactionId(transactionId)
  const senderFilled = paymentSender.length > 0
  const senderErr = Boolean(touched.sender) && senderFilled && !isValidBdPhone(paymentSender)
  const amountInvalid = amountPaid !== '' && amountPaid < 0

  const isFormValid =
    isValidFullName(fullName) &&
    isValidBdPhone(phone) &&
    isValidBdPhone(emergencyPhone) &&
    !isSamePhone(phone, emergencyPhone) &&
    isValidEmail(email) &&
    Boolean(gender) &&
    Boolean(dob) &&
    Boolean(jerseySize) &&
    (!txidRequired || isValidTransactionId(transactionId)) &&
    (paymentSender === '' || isValidBdPhone(paymentSender)) &&
    !amountInvalid &&
    (registrationType !== 'discounted' || (amountPaid !== '' && amountPaid > 0))

  function validate(): string | null {
    if (!isValidFullName(fullName)) return REGISTER_ERROR_MESSAGES.bad_name
    if (!isValidBdPhone(phone) || !isValidBdPhone(emergencyPhone)) return REGISTER_ERROR_MESSAGES.bad_phone
    if (isSamePhone(phone, emergencyPhone)) return REGISTER_ERROR_MESSAGES.same_phone
    if (!isValidEmail(email)) return REGISTER_ERROR_MESSAGES.bad_email
    if (paymentSender !== '' && !isValidBdPhone(paymentSender)) return REGISTER_ERROR_MESSAGES.bad_phone
    if (txidRequired && !isValidTransactionId(transactionId)) return REGISTER_ERROR_MESSAGES.bad_txid
    if (registrationType === 'discounted' && (amountPaid === '' || amountPaid <= 0)) return 'ছাড়কৃত রেজিস্ট্রেশনের জন্য সঠিক Amount Paid দিন।'
    if (amountPaid !== '' && amountPaid < 0) return 'Amount Paid ঋণাত্মক হতে পারবে না।'
    return null
  }

  function resetForm() {
    setFullName(''); setPhone(''); setEmergencyPhone(''); setEmail(''); setGender(''); setDob('')
    setBloodGroup(''); setJerseySize(''); setAddress(''); setComments(''); setPaymentMethod('')
    setPaymentSender(''); setTransactionId(''); setRole('runner'); setRegistrationType('paid')
    setDiscountReason(''); setComplimentaryReason(''); setGroupName(''); setAmountPaid(''); setCategoryChoice(AUTO); setTouched({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEventId) return
    setMessage(null)
    const validationError = validate()
    if (validationError) {
      setMessage({ type: 'error', text: validationError })
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('admin_register_participant', {
      p_event_id: selectedEventId,
      p_category_id: resolvedCategoryId,
      p_full_name: fullName,
      p_phone: normalizePhone(phone),
      p_email: email,
      p_gender: gender,
      p_date_of_birth: dob,
      p_blood_group: bloodGroup || null,
      p_jersey_size: jerseySize || null,
      p_address: address || null,
      p_emergency_phone: normalizePhone(emergencyPhone),
      p_comments: comments || null,
      p_payment_method: paymentMethod || null,
      p_payment_sender: paymentSender ? normalizePhone(paymentSender) : null,
      p_transaction_id: transactionId,
      p_participant_role: role,
      p_entry_source: entrySource,
      p_registration_type: registrationType,
      p_discount_reason: registrationType === 'discounted' ? discountReason || null : null,
      p_complimentary_reason: registrationType === 'complimentary' ? complimentaryReason || null : null,
      p_authorized_by: authorizedBy || null,
      p_group_name: groupName || null,
      p_amount_paid: registrationType === 'complimentary' ? null : amountPaid === '' ? null : amountPaid,
    })
    setSubmitting(false)
    if (error) {
      // Translate raw Postgres unique-violation errors into the same friendly
      // Bangla codes the public form uses, instead of a bare "try again".
      const msg = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
      const code = msg.includes('phone')
        ? 'dup_phone'
        : msg.includes('txid') || msg.includes('transaction')
          ? 'dup_txid'
          : null
      setMessage({ type: 'error', text: (code && REGISTER_ERROR_MESSAGES[code]) ?? 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।' })
      return
    }
    const res = data as { ok: boolean; ref_code?: string; status?: string; error?: string }
    if (res.ok) {
      setAdded({ ref: res.ref_code ?? '', name: fullName, status: res.status ?? 'pending' })
      resetForm()
      window.scrollTo(0, 0)
    } else {
      setMessage({ type: 'error', text: (res.error && REGISTER_ERROR_MESSAGES[res.error]) ?? 'একটি সমস্যা হয়েছে।' })
    }
  }

  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  const today = new Date().toISOString().slice(0, 10)
  const fieldCls = (err: boolean) => cn('h-10', err && 'animate-shake border-destructive')

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-[860px] flex-col gap-4">
      <div className="admin-page-header">
        <div>
          <h1>Manual entry</h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">Bypasses capacity + duplicate guards — for organizers, crew, and offline payments.</p>
        </div>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      {/* 01 Athlete */}
      <SectionCard num="01" title="Athlete">
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Full name</AdminLabel>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} onBlur={() => mark('name')} onFocus={() => clear('name')} className={fieldCls(nameErr)} placeholder="Md. Rahim Uddin" required />
          {nameErr && <p className="text-xs text-destructive" lang="bn">নামে শুধু ইংরেজি অক্ষর ব্যবহার করুন</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Phone</AdminLabel>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => mark('phone')} onFocus={() => clear('phone')} className={cn(fieldCls(phoneErr), 'font-mono')} placeholder="01XXXXXXXXX" required />
          {phoneErr && <p className="text-xs text-destructive" lang="bn">সঠিক ১১ ডিজিটের নম্বর দিন</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Emergency phone</AdminLabel>
          <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} onBlur={() => mark('emergency')} onFocus={() => clear('emergency')} className={cn(fieldCls(emErr), 'font-mono')} placeholder="01XXXXXXXXX" required />
          {emErr && <p className="text-xs text-destructive" lang="bn">{samePhone ? 'Emergency নম্বর নিজের নম্বর থেকে আলাদা হতে হবে' : 'সঠিক ১১ ডিজিটের নম্বর দিন'}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Email</AdminLabel>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => mark('email')} onFocus={() => clear('email')} className={fieldCls(emailErr)} placeholder="name@example.com" required />
          {emailErr && <p className="text-xs text-destructive" lang="bn">সঠিক ইমেইল ঠিকানা দিন</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Gender</AdminLabel>
          <Select value={gender} onValueChange={(v) => setGender((v ?? '') as Gender)} items={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Date of birth</AdminLabel>
          <DateOfBirthPicker value={dob} onChange={setDob} max={today} compact valid={Boolean(dob)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Blood group</AdminLabel>
          <Select value={bloodGroup} onValueChange={(v) => setBloodGroup((v ?? '') as BloodGroup)} items={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => ({ value: b, label: b }))}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Jersey size</AdminLabel>
          <Select value={jerseySize} onValueChange={(v) => setJerseySize((v ?? '') as JerseySize)} items={['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => ({ value: s, label: s }))}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-full">
          <AdminLabel>Address</AdminLabel>
          <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </SectionCard>

      {/* 02 Classification */}
      <SectionCard num="02" title="Classification">
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Category</AdminLabel>
          <Select
            value={categoryChoice}
            onValueChange={(v) => setCategoryChoice(v ?? AUTO)}
            items={[{ value: AUTO, label: `Auto-detect${autoCategory ? ` (${autoCategory.name})` : ''}` }, { value: NA, label: 'N/A (non-runner)' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          >
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Auto-detect {autoCategory ? `(${autoCategory.name})` : ''}</SelectItem>
              <SelectItem value={NA}>N/A (non-runner)</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Participant role</AdminLabel>
          <Select value={role} onValueChange={(v) => setRole((v ?? 'runner') as ParticipantRole)} items={ROLES.map((r) => ({ value: r, label: r }))}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Entry source</AdminLabel>
          <Select value={entrySource} onValueChange={(v) => setEntrySource((v ?? 'admin_manual') as EntrySource)} items={[{ value: 'admin_manual', label: 'Admin manual' }, { value: 'group_import', label: 'Group import' }]}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="admin_manual">Admin manual</SelectItem><SelectItem value="group_import">Group import</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Registration type</AdminLabel>
          <Select value={registrationType} onValueChange={(v) => setRegistrationType((v ?? 'paid') as RegistrationType)} items={[{ value: 'paid', label: 'Paid' }, { value: 'discounted', label: 'Discounted' }, { value: 'complimentary', label: 'Complimentary' }]}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="discounted">Discounted</SelectItem><SelectItem value="complimentary">Complimentary</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Group name (optional)</AdminLabel>
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Authorized by</AdminLabel>
          <Input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} className="h-10" />
        </div>
        {registrationType === 'discounted' && (
          <div className="flex flex-col gap-1.5">
            <AdminLabel>Discount reason</AdminLabel>
            <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="h-10" />
          </div>
        )}
        {registrationType === 'complimentary' && (
          <div className="flex flex-col gap-1.5">
            <AdminLabel>Complimentary reason</AdminLabel>
            <Input value={complimentaryReason} onChange={(e) => setComplimentaryReason(e.target.value)} className="h-10" />
          </div>
        )}
      </SectionCard>

      {/* 03 Payment */}
      <SectionCard num="03" title="Payment">
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Payment method</AdminLabel>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod((v ?? '') as PaymentMethod)} items={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Sender number</AdminLabel>
          <Input value={paymentSender} onChange={(e) => setPaymentSender(e.target.value)} onBlur={() => mark('sender')} onFocus={() => clear('sender')} className={cn(fieldCls(senderErr), 'font-mono')} placeholder="01XXXXXXXXX" />
          {senderErr && <p className="text-xs text-destructive" lang="bn">সঠিক ১১ ডিজিটের নম্বর দিন</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Transaction ID</AdminLabel>
          <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value.toUpperCase())} onBlur={() => mark('txid')} onFocus={() => clear('txid')} className={cn(fieldCls(txidErr), 'font-mono')} placeholder={registrationType === 'complimentary' ? 'COMP-NAME' : '9AB3CD4EF5'} required={txidRequired} />
          {txidErr && <p className="text-xs text-destructive" lang="bn">সঠিক Transaction ID দিন (৮–১৫ অক্ষর)</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <AdminLabel>Amount paid (৳{registrationType === 'discounted' ? '' : ', optional'})</AdminLabel>
          <Input
            type="number"
            min={0}
            step={1}
            value={amountPaid}
            onChange={(e) => setAmountPaid(parseAmount(e.target.value))}
            className={cn('h-10 font-mono', ((registrationType === 'discounted' && amountPaid !== '' && amountPaid <= 0) || amountInvalid) && 'animate-shake border-destructive')}
            placeholder={resolvedCategory ? String(resolvedCategory.fee) : 'category fee'}
            required={registrationType === 'discounted'}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-full">
          <AdminLabel>Comments</AdminLabel>
          <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      </SectionCard>

      {added && (
        <div className="animate-rise border border-[#2e4a1e] bg-accent/[0.07] px-4 py-3.5">
          <p className="font-heading text-[12px] font-semibold tracking-[0.1em] text-accent uppercase">Added · {added.ref}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{added.name} is now on the start list as {added.status}.</p>
        </div>
      )}
      {message && <p className="text-sm text-destructive" lang="bn">{message.text}</p>}

      <button
        type="submit"
        disabled={submitting || !isFormValid}
        className="flex h-[50px] items-center justify-center gap-2.5 bg-accent font-heading text-[13px] font-semibold tracking-[0.2em] text-accent-foreground uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? <DashLoader inline label="সেভ হচ্ছে…" /> : 'Add to start list →'}
      </button>
    </form>
  )
}
