export function ClosedScreen({ message }: { message: string }) {
  return (
    <div className="sl-paper flex min-h-screen items-center justify-center px-6">
      <div className="sl-hard-shadow max-w-[420px] border-[1.5px] border-border-strong bg-card px-8 py-9 text-center">
        <p className="font-heading text-[13px] font-semibold tracking-[0.22em] uppercase" style={{ color: 'var(--warn)' }}>
          Registration closed
        </p>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[0.02em] uppercase" lang="bn">
          রেজিস্ট্রেশন বন্ধ
        </h2>
        <p className="mt-3 text-sm leading-[1.7] text-muted-foreground" lang="bn">
          {message}
        </p>
        <div className="sl-stripe mt-5 h-1" />
      </div>
    </div>
  )
}
