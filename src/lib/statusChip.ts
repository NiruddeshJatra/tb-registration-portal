import type { RegistrationStatus } from './types'

// Shared with RegistrationsPage's table rows and RegistrationDetailDrawer's header —
// keep both status chip usages reading from here so styling can't drift between them.
export const STATUS_CHIP_CLASS: Record<RegistrationStatus, string> = {
  pending: 'status-chip status-chip-pending',
  approved: 'status-chip status-chip-approved',
  rejected: 'status-chip status-chip-rejected',
  cancelled: 'status-chip status-chip-cancelled',
}
