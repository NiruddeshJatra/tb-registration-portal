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
        .select('slug, registration_open, event_date')
        .eq('is_archived', false)
        .order('event_date')

      if (cancelled) return
      // "/" belongs to the next race on the calendar that is taking entries, so
      // a later event opening early doesn't take it over from the nearer one.
      const today = new Date().toISOString().slice(0, 10)
      const open = data?.filter((e) => e.registration_open) ?? []
      const next = open.find((e) => e.event_date >= today) ?? open[open.length - 1]
      setSlug(next?.slug ?? data?.[data.length - 1]?.slug ?? null)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (slug === undefined) {
    return (
      <div className="sl-paper flex min-h-screen items-center justify-center">
        <DashLoader label="লোড হচ্ছে… / Loading…" />
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
