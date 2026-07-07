import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TapTileGroup } from '@/components/brand/TapTile'
import { FieldError, FieldLabel, inputBorder } from './fields'
import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import type { StepFieldProps } from '../RegisterPage'
import { isValidBdPhone, isValidTransactionId, formatTaka } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props extends StepFieldProps {
  event: EventRow
  category: CategoryRow | null
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step3Payment({ event, category, form, setField, touched, markTouched, clearTouched }: Props) {
  const senderFilled = form.payment_sender.length > 0
  const txFilled = form.transaction_id.length > 0
  const senderErr = Boolean(touched.sender) && senderFilled && !isValidBdPhone(form.payment_sender)
  const txErr = Boolean(touched.txid) && txFilled && !isValidTransactionId(form.transaction_id)

  return (
    <>
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-[0.02em] uppercase">Payment</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground" lang="bn">
          Send Money করে নিচের তথ্য দিন। Reference-এ আপনার নাম লিখুন।
        </p>
      </div>

      {/* send-money ticket */}
      <div className="flex flex-col gap-1.5 border-[1.5px] border-border-strong bg-foreground px-5 py-[18px] text-background">
        <p className="font-heading text-[10px] font-semibold tracking-[0.26em] text-faint uppercase">Send money to</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2.5">
          <p className="font-mono text-[26px] font-semibold tracking-[0.05em] text-accent">{event.payment_number ?? '—'}</p>
          {category && (
            <p className="font-mono text-[13px] font-medium">
              {formatTaka(category.fee)} <span className="text-faint">— {category.name}</span>
            </p>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] text-faint" lang="bn">
          {event.payment_methods.join(', ')} — Personal নম্বরে Send Money করুন।
        </p>
      </div>

      <TapTileGroup
        name="payment_method"
        label="Payment method"
        gloss="মাধ্যম"
        gridClassName="[grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]"
        value={form.payment_method}
        onChange={(v) => setField('payment_method', v as RegisterFormState['payment_method'])}
        options={event.payment_methods.map((m) => ({ value: m, label: m }))}
      />

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="payment_sender" gloss="যে নম্বর থেকে পাঠিয়েছেন">Sender number</FieldLabel>
        <Input
          id="payment_sender"
          type="tel"
          inputMode="numeric"
          value={form.payment_sender}
          onChange={(e) => setField('payment_sender', e.target.value)}
          onBlur={() => markTouched('sender')}
          onFocus={() => clearTouched('sender')}
          className={cn('h-[50px] font-mono', inputBorder(senderErr, senderFilled && !senderErr))}
          placeholder="01XXXXXXXXX"
        />
        <FieldError show={senderErr}>সঠিক ১১ ডিজিটের নম্বর দিন</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="transaction_id">Transaction ID</FieldLabel>
        <Input
          id="transaction_id"
          value={form.transaction_id}
          onChange={(e) => setField('transaction_id', e.target.value.toUpperCase())}
          onBlur={() => markTouched('txid')}
          onFocus={() => clearTouched('txid')}
          className={cn('h-[50px] font-mono uppercase', inputBorder(txErr, txFilled && !txErr))}
          placeholder="9AB3CD4EF5"
        />
        <FieldError show={txErr}>সঠিক Transaction ID দিন (৮–১৫ অক্ষর)</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="comments" gloss="মন্তব্য (ঐচ্ছিক)">Comments</FieldLabel>
        <Textarea id="comments" rows={2} value={form.comments} onChange={(e) => setField('comments', e.target.value)} />
      </div>
    </>
  )
}
