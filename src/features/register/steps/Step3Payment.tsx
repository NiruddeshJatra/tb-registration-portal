import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { CategoryRow, EventRow } from '@/lib/types'
import type { RegisterFormState } from '../formState'
import { isValidBdPhone, formatTaka } from '@/lib/format'

interface Props {
  event: EventRow
  category: CategoryRow | null
  form: RegisterFormState
  setField: <K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) => void
}

export function Step3Payment({ event, category, form, setField }: Props) {
  const senderTouched = form.payment_sender.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="text-foreground">{event.fee_note}</p>
        {event.payment_number && (
          <p className="text-lg font-semibold text-gold">{event.payment_number}</p>
        )}
        {category && (
          <p className="text-muted-foreground">
            ক্যাটাগরি ফি: <span className="font-semibold text-foreground">{formatTaka(category.fee)}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Payment Method / পেমেন্ট মাধ্যম</Label>
        <RadioGroup
          value={form.payment_method}
          onValueChange={(v) => setField('payment_method', v as RegisterFormState['payment_method'])}
          className="flex gap-4"
        >
          {event.payment_methods.map((m) => (
            <label
              key={m}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
            >
              <RadioGroupItem value={m} id={`method-${m}`} />
              {m}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_sender">Sender Number / যে নম্বর থেকে টাকা পাঠিয়েছেন</Label>
        <Input
          id="payment_sender"
          type="tel"
          inputMode="numeric"
          value={form.payment_sender}
          onChange={(e) => setField('payment_sender', e.target.value)}
          className="h-11"
          placeholder="01XXXXXXXXX"
        />
        {senderTouched && !isValidBdPhone(form.payment_sender) && (
          <p className="text-sm text-destructive">সঠিক ১১ ডিজিটের নম্বর দিন</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction_id">Transaction ID</Label>
        <Input
          id="transaction_id"
          value={form.transaction_id}
          onChange={(e) => setField('transaction_id', e.target.value.toUpperCase())}
          className="h-11 uppercase"
          placeholder="e.g. 9AB3CD4EF5"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="comments">Comments (optional) / মন্তব্য</Label>
        <Textarea id="comments" value={form.comments} onChange={(e) => setField('comments', e.target.value)} />
      </div>
    </div>
  )
}
