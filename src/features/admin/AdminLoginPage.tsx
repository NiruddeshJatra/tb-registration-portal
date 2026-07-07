import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function AdminLoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/admin" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      setError('ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।')
    }
  }

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 border border-border-strong bg-card p-6">
        <div className="text-center">
          <img src="/assets/triathlon-bd-shield-white.png" alt="Triathlon Bangladesh" className="mx-auto mb-3 h-14 w-auto" />
          <h1 className="font-heading text-2xl font-semibold tracking-[0.06em] text-foreground uppercase">
            TB <span className="text-accent">Race Ops</span>
          </h1>
          <p className="font-mono text-[11px] text-faint">Admin sign in</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="sl-label">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="sl-label">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11"
          />
        </div>

        {error && <p className="text-sm text-destructive" lang="bn">{error}</p>}

        <Button type="submit" disabled={submitting} className="h-11 w-full font-heading tracking-[0.16em] uppercase">
          {submitting ? 'সাইন ইন হচ্ছে...' : 'Sign In'}
        </Button>
      </form>
    </div>
  )
}
