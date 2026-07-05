const STEP_LABELS = ['Event', 'Personal', 'Payment', 'Review']

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
              n <= step ? 'bg-accent' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        ধাপ {step}/{total} &middot; {STEP_LABELS[step - 1]}
      </p>
    </div>
  )
}
