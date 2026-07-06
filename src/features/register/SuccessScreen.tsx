import { useState } from 'react'
import { GoldRing } from '@/components/brand/GoldRing'
import { formatTaka } from '@/lib/format'
import { FACEBOOK_PAGE_URL } from '@/lib/constants'

interface Props {
  refCode: string
  name: string
  categoryName: string
  fee: number
}

export function SuccessScreen({ refCode, name, categoryName, fee }: Props) {
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

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10 text-center">
      <GoldRing>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Reference Code</p>
        <p className="font-heading text-3xl text-gold">{refCode}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </GoldRing>

      <div className="animate-detail-reveal space-y-1" style={{ animationDelay: '900ms' }}>
        <p className="text-lg font-medium text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">
          {categoryName} &middot; {formatTaka(fee)}
        </p>
      </div>

      <div
        className="animate-detail-reveal rounded-lg border border-accent bg-accent/10 p-4 text-sm text-foreground"
        style={{ animationDelay: '1050ms' }}
      >
        আপনার রেজিস্ট্রেশন পেন্ডিং আছে — Transaction verify হলে confirm হবে।
      </div>

      <p className="animate-detail-reveal text-sm text-muted-foreground" style={{ animationDelay: '1200ms' }}>
        এই স্ক্রিনের স্ক্রিনশট রেখে দিন।
      </p>

      {FACEBOOK_PAGE_URL ? (
        <a
          href={FACEBOOK_PAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="animate-detail-reveal inline-block text-sm text-accent underline"
          style={{ animationDelay: '1350ms' }}
        >
          Triathlon Bangladesh — Facebook Page
        </a>
      ) : (
        <p className="animate-detail-reveal text-sm text-muted-foreground" style={{ animationDelay: '1350ms' }}>
          Triathlon Bangladesh Facebook Page (link coming soon)
        </p>
      )}
    </div>
  )
}
