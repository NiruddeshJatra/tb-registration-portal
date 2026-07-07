import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { DashLoader } from '@/components/brand/DashLoader'

export function DefaultEventRedirect() {
  const [slug, setSlug] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('slug, registration_open')
        .order('created_at', { ascending: false })

      if (cancelled) return
      const open = data?.find((e) => e.registration_open)
      setSlug(open?.slug ?? data?.[0]?.slug ?? null)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (slug === undefined) {
    return (
      <div className="sl-paper flex min-h-screen items-center justify-center">
        <DashLoader label="লোড হচ্ছে…" />
      </div>
    )
  }

  if (slug === null) {
    return (
      <div className="sl-paper flex min-h-screen items-center justify-center px-6 text-center text-foreground">
        <p lang="bn">এই মুহূর্তে কোনো ইভেন্ট নেই। / No event is currently configured.</p>
      </div>
    )
  }

  return <Navigate to={`/register/${slug}`} replace />
}
