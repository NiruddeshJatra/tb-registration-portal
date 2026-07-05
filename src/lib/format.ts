// Mirrors the normalization/validation rules enforced server-side in
// supabase/schema.sql's register_participant() — kept in sync manually since
// this project has no shared codegen between SQL and TS.

export function toTitleCase(input: string): string {
  const collapsed = input.trim().replace(/\s+/g, ' ')
  if (!collapsed) return ''
  const titled = collapsed
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ')
  return titled.replace(/\bMd\.?\b/gi, 'Md.')
}

export function normalizePhone(input: string): string {
  let digits = input.replace(/[^0-9]/g, '')
  if (digits.startsWith('880')) digits = digits.slice(3)
  return digits
}

export function isValidBdPhone(input: string): boolean {
  return /^01[3-9][0-9]{8}$/.test(normalizePhone(input))
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())
}

export function calculateAge(dateOfBirth: string, asOfDate: string): number {
  const dob = new Date(dateOfBirth)
  const asOf = new Date(asOfDate)
  let age = asOf.getFullYear() - dob.getFullYear()
  const monthDiff = asOf.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--
  }
  return age
}

export function formatTaka(amount: number): string {
  return `৳${amount.toLocaleString('en-US')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
