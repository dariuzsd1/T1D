'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ScanLine,
  CalendarDays,
  Map,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Rotate', href: '/dashboard/site-tracker', icon: Map },
  { name: 'Add', href: '/scan', icon: ScanLine },
  { name: 'Calendar', href: '/dashboard/calendar', icon: CalendarDays },
]

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-line flex-col h-screen sticky top-0 bg-surface">
        <div className="p-6">
          <div className="flex items-center gap-3 text-primary mb-8">
            <ShieldCheck className="w-7 h-7" />
            <span className="font-bold text-lg tracking-tight text-ink">T1D Hub</span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-muted hover:text-ink hover:bg-surface-2'
                  )}
                >
                  <item.icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-faint group-hover:text-primary')} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-1">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-muted hover:text-ink hover:bg-surface-2 w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Settings className="w-5 h-5" />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-muted hover:text-urgent hover:bg-urgent-soft w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-[105] bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 min-h-[56px] py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  isActive ? 'text-primary' : 'text-faint'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
