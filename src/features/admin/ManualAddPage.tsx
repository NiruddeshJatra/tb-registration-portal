import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { useEvents } from './useEvents'
import { EventSelector } from './EventSelector'
import { Input } from '@/components/ui/input'
import { DateOfBirthPicker } from '@/components/brand/DateOfBirthPicker'
import { BrandLoader } from '@/components/brand/BrandLoader'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { matchCategory } from '@/features/register/formState'
import { isSamePhone, isValidBdPhone, isValidEmail, isValidFullName, isValidTransactionId, normalizePhone } from '@/lib/format'
import { REGISTER_ERROR_MESSAGES } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'
import type { CategoryRow, Gender, ParticipantRole, RegistrationType, EntrySource, JerseySize, BloodGroup, PaymentMethod } from '@/lib/types'

const ROLES: ParticipantRole[] = ['runner', 'organizer', 'crew', 'mentor', 'ambassador', 'guest', 'pacer', 'volunteer']
const AUTO = '__auto__'
const NA = '__na__'

export function ManualAddPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
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

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (session?.user.email) setAuthorizedBy(session.user.email)
  }, [session])

  useEffect(() => {
    if (!selectedEventId) return
    supabase
      .from('categories')
      .select('*')
      .eq('event_id', selectedEventId)
      .order('display_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [selectedEventId])

  const autoCategory =
    gender && dob && selectedEvent ? matchCategory(categories, gender, dob, selectedEvent.event_date) : null
  const resolvedCategoryId = categoryChoice === AUTO ? autoCategory?.id ?? null : categoryChoice === NA ? null : categoryChoice
  const resolvedCategory = categories.find((c) => c.id === resolvedCategoryId) ?? null

  function parseAmount(raw: string): number | '' {
    const trimmed = raw.trim()
    if (trimmed === '') return ''
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : ''
  }

  // live, per-field validation — mirrors the public registration wizard
  const nameTouched = fullName.length > 0
  const phoneTouched = phone.length > 0
  const emergencyTouched = emergencyPhone.length > 0
  const emailTouched = email.length > 0
  const txidTouched = transactionId.length > 0
  const txidRequired = !(registrationType === 'complimentary' && transactionId.trim() === '')

  const nameInvalid = nameTouched && !isValidFullName(fullName)
  const phoneInvalid = phoneTouched && !isValidBdPhone(phone)
  const samePhone = phoneTouched && emergencyTouched && isSamePhone(phone, emergencyPhone)
  const emergencyInvalid = emergencyTouched && (!isValidBdPhone(emergencyPhone) || samePhone)
  const emailInvalid = emailTouched && !isValidEmail(email)
  const txidInvalid = txidTouched && txidRequired && !isValidTransactionId(transactionId)
  const amountInvalid = amountPaid !== '' && amountPaid < 0

  const isFormValid =
    isValidFullName(fullName) &&
    isValidBdPhone(phone) &&
    isValidBdPhone(emergencyPhone) &&
    !isSamePhone(phone, emergencyPhone) &&
    isValidEmail(email) &&
    Boolean(gender) &&
    Boolean(dob) &&
    (!txidRequired || isValidTransactionId(transactionId)) &&
    !amountInvalid &&
    (registrationType !== 'discounted' || (amountPaid !== '' && amountPaid > 0))

  function validate(): string | null {
    if (!isValidFullName(fullName)) return REGISTER_ERROR_MESSAGES.bad_name
    if (!isValidBdPhone(phone) || !isValidBdPhone(emergencyPhone)) return REGISTER_ERROR_MESSAGES.bad_phone
    if (isSamePhone(phone, emergencyPhone)) return REGISTER_ERROR_MESSAGES.same_phone
    if (!isValidEmail(email)) return REGISTER_ERROR_MESSAGES.bad_email
    if (txidRequired && !isValidTransactionId(transactionId)) return REGISTER_ERROR_MESSAGES.bad_txid
    if (registrationType === 'discounted' && (amountPaid === '' || amountPaid <= 0)) {
      return 'ছাড়কৃত রেজিস্ট্রেশনের জন্য সঠিক Amount Paid দিন।'
    }
    if (amountPaid !== '' && amountPaid < 0) return 'Amount Paid ঋণাত্মক হতে পারবে না।'
    return null
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
      setMessage({ type: 'error', text: 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।' })
      return
    }
    const res = data as { ok: boolean; ref_code?: string; error?: string }
    if (res.ok) {
      navigate('/admin/registrations')
    } else {
      setMessage({ type: 'error', text: (res.error && REGISTER_ERROR_MESSAGES[res.error]) ?? 'একটি সমস্যা হয়েছে।' })
    }
  }

  if (events.length === 0) return <p className="text-muted-foreground">No events configured yet.</p>

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
      <div className="admin-page-header">
        <h1>Add Entry</h1>
        <EventSelector events={events} selectedEventId={selectedEventId} onChange={setSelectedEventId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={cn(nameInvalid && 'animate-shake border-destructive')}
            required
          />
          {nameInvalid && <p className="text-sm text-destructive">নামে শুধু ইংরেজি অক্ষর ব্যবহার করুন</p>}
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={cn(phoneInvalid && 'animate-shake border-destructive')}
            required
          />
          {phoneInvalid && <p className="text-sm text-destructive">সঠিক ১১ ডিজিটের নম্বর দিন</p>}
        </div>
        <div className="space-y-2">
          <Label>Emergency Phone</Label>
          <Input
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
            className={cn(emergencyInvalid && 'animate-shake border-destructive')}
            required
          />
          {emergencyTouched && !isValidBdPhone(emergencyPhone) && (
            <p className="text-sm text-destructive">সঠিক ১১ ডিজিটের নম্বর দিন</p>
          )}
          {emergencyTouched && isValidBdPhone(emergencyPhone) && samePhone && (
            <p className="text-sm text-destructive">Emergency নম্বর নিজের নম্বর থেকে আলাদা হতে হবে</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(emailInvalid && 'animate-shake border-destructive')}
            required
          />
          {emailInvalid && <p className="text-sm text-destructive">সঠিক ইমেইল ঠিকানা দিন</p>}
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date of Birth</Label>
          <DateOfBirthPicker value={dob} onChange={setDob} max={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="space-y-2">
          <Label>Blood Group</Label>
          <Select value={bloodGroup} onValueChange={(v) => setBloodGroup(v as BloodGroup)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Jersey Size</Label>
          <Select value={jerseySize} onValueChange={(v) => setJerseySize(v as JerseySize)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={categoryChoice}
          onValueChange={(v) => setCategoryChoice(v ?? AUTO)}
          items={[
            { value: AUTO, label: `Auto-detect from age/gender${autoCategory ? ` (${autoCategory.name})` : ''}` },
            { value: NA, label: 'N/A (non-runner)' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>Auto-detect from age/gender {autoCategory ? `(${autoCategory.name})` : ''}</SelectItem>
            <SelectItem value={NA}>N/A (non-runner)</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Participant Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as ParticipantRole)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Entry Source</Label>
          <Select value={entrySource} onValueChange={(v) => setEntrySource(v as EntrySource)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_manual">Admin Manual</SelectItem>
              <SelectItem value="group_import">Group Import</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Registration Type</Label>
          <Select value={registrationType} onValueChange={(v) => setRegistrationType(v as RegistrationType)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="discounted">Discounted</SelectItem>
              <SelectItem value="complimentary">Complimentary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Group Name (optional)</Label>
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        </div>
      </div>

      {registrationType === 'discounted' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Discount Reason</Label>
            <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Amount Paid (৳)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={amountPaid}
              onChange={(e) => setAmountPaid(parseAmount(e.target.value))}
              className={cn(amountPaid !== '' && amountPaid <= 0 && 'animate-shake border-destructive')}
              required
            />
            {amountPaid !== '' && amountPaid <= 0 && (
              <p className="text-sm text-destructive">ছাড়কৃত রেজিস্ট্রেশনের জন্য সঠিক Amount Paid দিন।</p>
            )}
          </div>
        </div>
      )}
      {registrationType === 'complimentary' && (
        <div className="space-y-2">
          <Label>Complimentary Reason</Label>
          <Input value={complimentaryReason} onChange={(e) => setComplimentaryReason(e.target.value)} />
        </div>
      )}
      {registrationType === 'paid' && (
        <div className="space-y-2">
          <Label>Amount Paid (৳, optional — defaults to category fee)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder={resolvedCategory ? String(resolvedCategory.fee) : 'category fee'}
            value={amountPaid}
            onChange={(e) => setAmountPaid(parseAmount(e.target.value))}
            className={cn(amountInvalid && 'animate-shake border-destructive')}
          />
          {amountInvalid && <p className="text-sm text-destructive">Amount Paid ঋণাত্মক হতে পারবে না।</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label>Authorized By</Label>
        <Input value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bKash">bKash</SelectItem>
              <SelectItem value="Nagad">Nagad</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment Sender</Label>
          <Input value={paymentSender} onChange={(e) => setPaymentSender(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Transaction ID</Label>
          <Input
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
            placeholder={registrationType === 'complimentary' ? 'e.g. COMP-<name>' : 'e.g. 9AB3CD4EF5'}
            className={cn(txidInvalid && 'animate-shake border-destructive')}
            required={txidRequired}
          />
          {txidInvalid && <p className="text-sm text-destructive">সঠিক Transaction ID দিন (৮–১২ অক্ষর)</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Comments</Label>
        <Textarea value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>

      {message && (
        <p className={message.type === 'success' ? 'text-accent' : 'text-destructive'}>{message.text}</p>
      )}

      <Button type="submit" disabled={submitting || !isFormValid} className="btn-sheen h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {submitting ? <BrandLoader inline label="Saving..." /> : 'Add Entry'}
      </Button>
    </form>
  )
}
