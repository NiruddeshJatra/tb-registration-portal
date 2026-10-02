import type { BikeType, BloodGroup, CategoryRow, EventRow, Gender, JerseySize, PaymentMethod, TransportMode } from '@/lib/types'
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
  // Only used by events with manual_category_select — the distance tile the
  // athlete picked (e.g. '10K'). Auto-match events leave it empty.
  category_name: string
  bike_type: BikeType | ''
  transport_mode: TransportMode | ''
  shuttle_point: string
  // Storage object path of the uploaded NID/passport photo; the file itself is
  // uploaded the moment it is picked, so the draft only has to remember this.
  id_document_path: string
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
  transport_mode: '',
  shuttle_point: '',
  id_document_path: '',
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

// The tile a category sits behind. Events with several rows per distance
// (General / Veteran) set group_label; the rest use the name itself.
export function categoryLabel(category: CategoryRow): string {
  return category.group_label ?? category.name
}

// Distinct tile labels in display order — the 5K/10K/21K tiles for
// manual_category_select events, deduped from the per-gender/per-age rows.
export function distinctCategoryNames(categories: CategoryRow[]): string[] {
  const seen: string[] = []
  for (const c of [...categories].sort((a, b) => a.display_order - b.display_order)) {
    if (!seen.includes(categoryLabel(c))) seen.push(categoryLabel(c))
  }
  return seen
}

// True when the athlete's age on race day puts them at or over the event's
// ID-photo threshold (veteran podium verification).
export function needsIdDocument(event: EventRow, dateOfBirth: string): boolean {
  if (event.id_doc_min_age === null || !dateOfBirth) return false
  return calculateAge(dateOfBirth, event.event_date) >= event.id_doc_min_age
}

// The single category row a submission maps to. Manual-select events resolve by
// (tile picked, gender, age band); everything else keeps the age/gender auto-match.
export function resolveCategory(
  event: EventRow,
  categories: CategoryRow[],
  form: RegisterFormState,
): CategoryRow | null {
  if (!form.gender) return null
  if (event.manual_category_select) {
    if (!form.category_name || !form.date_of_birth) return null
    return matchCategory(
      categories.filter((c) => categoryLabel(c) === form.category_name),
      form.gender,
      form.date_of_birth,
      event.event_date,
    )
  }
  if (!form.date_of_birth) return null
  return matchCategory(categories, form.gender, form.date_of_birth, event.event_date)
}
