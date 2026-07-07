import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'
import { DashLoader } from '@/components/brand/DashLoader'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', num: '01', end: true },
  { to: '/admin/registrations', label: 'Registrations', num: '02' },
  { to: '/admin/add', label: 'Add Entry', num: '03' },
  { to: '/admin/events', label: 'Event Config', num: '04' },
  { to: '/admin/reports', label: 'Reports', num: '05' },
]

export function AdminLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background text-foreground">
        <DashLoader label="লোড হচ্ছে…" />
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* header */}
      <header className="flex flex-wrap items-center gap-5 border-b border-border px-6 py-3.5">
        <div className="flex items-center gap-3">
          <img src="/assets/triathlon-bd-shield-white.png" alt="" className="h-[34px] w-auto" />
          <div>
            <p className="font-heading text-sm font-semibold tracking-[0.22em] uppercase">
              TB <span className="text-accent">Race Ops</span>
            </p>
            <p className="font-mono text-[10px] text-faint">register.triathlonbangladesh.com</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <p className="font-mono text-[11px] text-faint">{session.user.email}</p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="border border-border px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:border-faint hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* nav */}
      <nav className="flex gap-0.5 overflow-x-auto border-b border-border px-6">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-baseline gap-[7px] whitespace-nowrap border-b-2 px-4 pt-3 pb-2.5 transition-colors hover:bg-accent/[0.04] ${
                isActive ? 'border-accent' : 'border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`font-mono text-[9px] ${isActive ? 'text-accent' : 'text-faint/60'}`}>{item.num}</span>
                <span
                  className={`font-heading text-xs font-semibold tracking-[0.18em] uppercase ${isActive ? 'text-foreground' : 'text-faint'}`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
