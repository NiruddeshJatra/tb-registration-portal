import { cn } from '@/lib/utils'

// Oswald section label with an inline Bengali gloss, matching the wizard spec.
export function FieldLabel({ htmlFor, children, gloss }: { htmlFor?: string; children: React.ReactNode; gloss?: string }) {
  return (
    <label htmlFor={htmlFor} className="sl-label">
      {children}
      {gloss && (
        <span className="ml-1 font-sans text-[11px] font-normal tracking-normal text-muted-foreground normal-case" lang="bn">
          / {gloss}
        </span>
      )}
    </label>
  )
}

// Bengali error line, shown on blur. lang="bn" for screen readers.
export function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <p className="animate-shake text-[12.5px] text-destructive" lang="bn">
      {children}
    </p>
  )
}

// Wizard text input border resolves idle / valid / error.
export function inputBorder(error: boolean, valid: boolean): string {
  return cn(error ? 'border-destructive animate-shake' : valid ? 'border-border-strong' : 'border-border')
}
