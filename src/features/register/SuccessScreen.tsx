import { useState } from 'react'
import { formatDate, formatTaka } from '@/lib/format'
import { FACEBOOK_PAGE_URL, TRIATHLON_BANGLADESH_URL } from '@/lib/constants'
import type { EventRow } from '@/lib/types'

interface Props {
  event: EventRow
  refCode: string
  name: string
  categoryName: string
  fee: number
}

// The race bib — the registrant's only receipt. Border draws itself, PENDING
// stamp lands at 1.5s. Successor to the retired GoldRing "the receipt draws itself".
export function SuccessScreen({ event, refCode, name, categoryName, fee }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(refCode)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = refCode
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — the ref code is already visible on screen
    }
  }

  const year = event.name.match(/\d{4}/)?.[0] ?? ''
  const nameNoYear = event.name.replace(/\s*\d{4}\s*$/, '')

  return (
    <div className="sl-paper flex min-h-screen flex-col items-center px-4 pt-10 pb-16">
      <p className="animate-rise mb-1.5 font-heading text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
        You're on the start list
      </p>
      <h2 className="animate-rise mb-7 font-heading text-[15px] font-semibold text-foreground" style={{ animationDelay: '0.1s' }} lang="bn">
        রেজিস্ট্রেশন সম্পন্ন হয়েছে 🎉
      </h2>

      {/* bib */}
      <div
        className="animate-rise relative w-full max-w-[400px] bg-card"
        style={{ animationDelay: '0.15s', filter: 'drop-shadow(0 24px 40px rgba(21,24,14,.28))' }}
      >
        {/* drawn border */}
        <svg
          className="pointer-events-none absolute z-[3]"
          style={{ inset: '-2px', width: 'calc(100% + 4px)', height: 'calc(100% + 4px)' }}
          preserveAspectRatio="none"
          viewBox="0 0 400 560"
          aria-hidden="true"
        >
          <rect
            x="2" y="2" width="396" height="556" fill="none" stroke="#15180E" strokeWidth="3"
            pathLength={100} strokeDasharray={100} strokeDashoffset={100}
            style={{ animation: 'sl-draw 1.2s ease-out .5s forwards' }}
          />
        </svg>
        {/* punch holes */}
        <div className="absolute top-3.5 left-[22px] z-[4] h-3 w-3 rounded-full border-[1.5px] border-border-strong bg-background" />
        <div className="absolute top-3.5 right-[22px] z-[4] h-3 w-3 rounded-full border-[1.5px] border-border-strong bg-background" />

        {/* header strip */}
        <div className="border-b-[1.5px] border-border-strong bg-accent px-6 pt-[34px] pb-3">
          <div className="flex items-baseline justify-between">
            <p className="font-heading text-[17px] font-bold tracking-[0.06em] text-foreground uppercase">{nameNoYear}</p>
            <p className="font-heading text-[17px] font-bold tracking-[0.06em] text-foreground">{year}</p>
          </div>
          <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-foreground uppercase">
            {formatDate(event.event_date)} · {event.venue.split(',')[0]} · <span className="whitespace-nowrap">10K—40K—5K</span>
          </p>
        </div>

        {/* ref code */}
        <div className="border-b-[1.5px] border-dashed border-foreground/35 px-6 pt-[30px] pb-[22px] text-center">
          <p className="font-heading text-[11px] font-semibold tracking-[0.32em] text-muted-foreground uppercase">Reference Code</p>
          <p className="mt-2 font-heading text-[52px] leading-none font-semibold tracking-[0.04em] text-foreground">{refCode}</p>
          <button
            type="button"
            onClick={handleCopy}
            className={`mt-3.5 border-[1.5px] border-border-strong px-[18px] py-[7px] font-mono text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase transition-colors ${
              copied ? 'bg-foreground text-accent' : 'bg-card text-foreground'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy code'}
          </button>
        </div>

        {/* details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-b-[1.5px] border-border-strong px-6 py-5">
          <div className="col-span-2">
            <p className="font-heading text-[9px] font-semibold tracking-[0.28em] text-muted-foreground uppercase">Athlete</p>
            <p className="mt-0.5 font-heading text-[20px] font-semibold tracking-[0.03em] text-foreground uppercase">{name}</p>
          </div>
          <div>
            <p className="font-heading text-[9px] font-semibold tracking-[0.28em] text-muted-foreground uppercase">Category</p>
            <p className="mt-0.5 text-sm font-medium">{categoryName}</p>
          </div>
          <div>
            <p className="font-heading text-[9px] font-semibold tracking-[0.28em] text-muted-foreground uppercase">Fee</p>
            <p className="mt-0.5 font-mono text-sm font-medium">{formatTaka(fee)}</p>
          </div>
        </div>

        {/* status footer */}
        <div className="relative flex items-center justify-between gap-3 px-6 pt-[18px] pb-[22px]">
          <p className="max-w-[210px] text-xs leading-[1.65] text-muted-foreground" lang="bn">
            রেজিস্ট্রেশন পেন্ডিং আছে — transaction verify হলে confirm হবে।
          </p>
          <div
            className="animate-stamp origin-center border-[2.5px] px-3 py-[7px] font-heading text-[13px] font-bold tracking-[0.18em] uppercase"
            style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}
          >
            Pending
          </div>
        </div>

        {/* route foot stripe */}
        <div className="sl-stripe h-1.5" />
      </div>

      <p className="animate-rise mt-7 text-[13px] font-medium text-foreground" style={{ animationDelay: '1.9s' }} lang="bn">
        📸 এই স্ক্রিনের স্ক্রিনশট রেখে দিন — এটাই আপনার রিসিট।
      </p>
      <div className="animate-rise mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5" style={{ animationDelay: '2s' }}>
        <a
          href={TRIATHLON_BANGLADESH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-muted-foreground underline underline-offset-[3px]"
        >
          triathlonbangladesh.com ↗
        </a>
        {FACEBOOK_PAGE_URL && (
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-muted-foreground underline underline-offset-[3px]"
          >
            Facebook Page ↗
          </a>
        )}
      </div>
    </div>
  )
}
