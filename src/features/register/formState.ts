import type { BikeType, BloodGroup, CategoryRow, EventRow, Gender, JerseySize, PaymentMethod } from '@/lib/types'
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
  // Only used by events with manual_category_select — the distance the athlete
  // picked (e.g. '10K'). Auto-match events leave it empty.
  category_name: string
  bike_type: BikeType | ''
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
  category_name: '',
  bike_type: '',
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

// Distinct category names in display order — the 5K/10K/21K tiles for
// manual_category_select events, deduped from the per-gender rows.
export function distinctCategoryNames(categories: CategoryRow[]): string[] {
  const seen: string[] = []
  for (const c of [...categories].sort((a, b) => a.display_order - b.display_order)) {
    if (!seen.includes(c.name)) seen.push(c.name)
  }
  return seen
}

// The single category row a submission maps to. Manual-select events resolve by
// (name picked, gender); everything else keeps the age/gender auto-match.
export function resolveCategory(
  event: EventRow,
  categories: CategoryRow[],
  form: RegisterFormState,
): CategoryRow | null {
  if (!form.gender) return null
  if (event.manual_category_select) {
    if (!form.category_name) return null
    return categories.find((c) => c.name === form.category_name && c.gender === form.gender) ?? null
  }
  if (!form.date_of_birth) return null
  return matchCategory(categories, form.gender, form.date_of_birth, event.event_date)
}
