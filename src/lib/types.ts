export type Gender = 'male' | 'female'

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export type JerseySize = 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL'

export type PaymentMethod = 'bKash' | 'Nagad'

export type ParticipantRole =
  | 'runner'
  | 'organizer'
  | 'crew'
  | 'mentor'
  | 'ambassador'
  | 'guest'
  | 'pacer'
  | 'volunteer'

export type EntrySource = 'self' | 'admin_manual' | 'group_import'

export type RegistrationType = 'paid' | 'discounted' | 'complimentary'

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface JerseyChartRow {
  size: JerseySize
  chest: number
  length: number
}

export interface EventRow {
  id: string
  name: string
  slug: string
  short_code: string
  event_date: string
  venue: string
  registration_open: boolean
  registration_deadline: string | null
  max_total_slots: number | null
  fee_note: string | null
  payment_number: string | null
  payment_methods: PaymentMethod[]
  jersey_chart: JerseyChartRow[]
  reg_counter: number
  created_at: string
}

export interface CategoryRow {
  id: string
  event_id: string
  name: string
  gender: Gender
  min_age: number
  max_age: number | null
  fee: number
  max_slots: number | null
  display_order: number
}

export interface RegistrationRow {
  id: string
  ref_code: string | null
  event_id: string
  category_id: string | null
  full_name: string
  phone: string
  email: string
  gender: Gender
  date_of_birth: string
  blood_group: BloodGroup | null
  jersey_size: JerseySize | null
  address: string | null
  emergency_phone: string
  comments: string | null
  payment_method: PaymentMethod | null
  payment_sender: string | null
  transaction_id: string | null
  amount_paid: number | null
  consent_given_at: string
  participant_role: ParticipantRole
  entry_source: EntrySource
  registration_type: RegistrationType
  discount_reason: string | null
  complimentary_reason: string | null
  authorized_by: string | null
  group_name: string | null
  status: RegistrationStatus
  managed_by: string | null
  admin_comment: string | null
  status_changed_at: string | null
  created_at: string
}

export type RegisterParticipantError =
  | 'event_not_found'
  | 'registration_closed'
  | 'deadline_passed'
  | 'event_full'
  | 'bad_phone'
  | 'same_phone'
  | 'bad_email'
  | 'bad_name'
  | 'bad_txid'
  | 'no_category'
  | 'category_full'
  | 'dup_txid'
  | 'dup_phone'

export type RegisterParticipantResult =
  | { ok: true; ref_code: string; category_name: string; fee: number; status: 'pending' }
  | { ok: false; error: RegisterParticipantError }
