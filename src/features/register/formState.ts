import type { BloodGroup, CategoryRow, Gender, JerseySize, PaymentMethod } from '@/lib/types'
import { calculateAge } from '@/lib/format'

export interface RegisterFormState {
  gender: Gender | ''
  date_of_birth: string
  full_name: string
  phone: string
  emergency_phone: string
  email: string
  blood_group: BloodGroup | ''
  jersey_size: JerseySize | ''
  address: string
  payment_method: PaymentMethod | ''
  payment_sender: string
  transaction_id: string
  comments: string
  consent: boolean
  honeypot: string
}

export const EMPTY_FORM: RegisterFormState = {
  gender: '',
  date_of_birth: '',
  full_name: '',
  phone: '',
  emergency_phone: '',
  email: '',
  blood_group: '',
  jersey_size: '',
  address: '',
  payment_method: '',
  payment_sender: '',
  transaction_id: '',
  comments: '',
  consent: false,
  honeypot: '',
}

export function isFormDirty(form: RegisterFormState): boolean {
  return JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)
}

export function matchCategory(
  categories: CategoryRow[],
  gender: Gender,
  dateOfBirth: string,
  eventDate: string,
): CategoryRow | null {
  const age = calculateAge(dateOfBirth, eventDate)
  const matches = categories
    .filter((c) => c.gender === gender && age >= c.min_age && (c.max_age === null || age <= c.max_age))
    .sort((a, b) => a.display_order - b.display_order)
  return matches[0] ?? null
}
