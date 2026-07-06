import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { BrandLoader } from '@/components/brand/BrandLoader'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/registrations', label: 'Registrations' },
  { to: '/admin/add', label: 'Add Entry' },
  { to: '/admin/events', label: 'Event Config' },
  { to: '/admin/reports', label: 'Reports' },
]

export function AdminLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <BrandLoader />
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/assets/triathlon-bd-shield-white.png" alt="Triathlon Bangladesh" className="h-8 w-auto" />
          <div>
            <p className="font-heading text-lg text-foreground">Triathlon Bangladesh</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </Button>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                isActive ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
