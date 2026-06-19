'use client'

import { useState } from 'react'
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
  Pill,
  Users,
  Stethoscope,
  HeartPulse,
  DollarSign,
  MoreHorizontal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useDialog } from '@/lib/useDialog'

// Core destinations — shown in both the desktop sidebar and the mobile tab bar.
const navItems = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Rotate', href: '/dashboard/site-tracker', icon: Map },
  { name: 'Add', href: '/scan', icon: ScanLine },
  { name: 'Calendar', href: '/dashboard/calendar', icon: CalendarDays },
]

// Secondary destinations — desktop sidebar only, to keep the mobile bar to four
// thumb-reachable items.
const secondaryNav = [
  { name: 'Prescriptions', href: '/dashboard/prescriptions', icon: Pill },
  { name: 'Appointments', href: '/dashboard/appointments', icon: Stethoscope },
  { name: 'Costs', href: '/dashboard/costs', icon: DollarSign },
  { name: 'Caregivers', href: '/dashboard/caregivers', icon: Users },
  { name: 'Medical ID', href: '/dashboard/medical-id', icon: HeartPulse },
]

export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [moreOpen, setMoreOpen] = useState(false)

  // Highlight "More" when the active page lives behind it.
  const moreActive =
    secondaryNav.some((i) => pathname === i.href) || pathname === '/dashboard/settings'

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

            <div className="my-3 border-t border-line" />

            {secondaryNav.map((item) => {
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
          <Link
            href="/dashboard/settings"
            aria-current={pathname === '/dashboard/settings' ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              pathname === '/dashboard/settings'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink hover:bg-surface-2'
            )}
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
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
                  isActive ? 'text-primary' : 'text-muted'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 min-h-[56px] py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
              moreActive ? 'text-primary' : 'text-muted'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            More
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet — surfaces the desktop-sidebar destinations on phones */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-[110]">
          <button
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <MoreSheet
            pathname={pathname}
            onClose={() => setMoreOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      )}
    </>
  )
}

interface MoreSheetProps {
  pathname: string
  onClose: () => void
  onLogout: () => void
}

function MoreSheet({ pathname, onClose, onLogout }: MoreSheetProps) {
  const ref = useDialog<HTMLDivElement>(onClose)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="More navigation options"
      tabIndex={-1}
      className="absolute bottom-0 inset-x-0 bg-surface border-t border-line rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg focus:outline-none"
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
      <div className="space-y-1">
        {secondaryNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive ? 'bg-primary text-white' : 'text-ink hover:bg-surface-2'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-faint')} />
              {item.name}
            </Link>
          )
        })}
        <Link
          href="/dashboard/settings"
          onClick={onClose}
          aria-current={pathname === '/dashboard/settings' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            pathname === '/dashboard/settings' ? 'bg-primary text-white' : 'text-ink hover:bg-surface-2'
          )}
        >
          <Settings className={cn('w-5 h-5', pathname === '/dashboard/settings' ? 'text-white' : 'text-faint')} />
          Settings
        </Link>
        <button
          onClick={() => { onClose(); onLogout() }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-muted hover:text-urgent hover:bg-urgent-soft w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </div>
  )
}
