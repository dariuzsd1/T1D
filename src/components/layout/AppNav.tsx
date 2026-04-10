'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  ScanLine, 
  CalendarDays, 
  Map, 
  Settings, 
  LogOut,
  ShieldCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Scan Supply', href: '/scan', icon: ScanLine },
  // TODO: Fix these pages with missing imports
  // { name: 'Forecast', href: '/calendar', icon: CalendarDays },
  // { name: 'Site Tracker', href: '/site-tracker', icon: Map },
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
    <div className="w-64 border-r border-white/10 flex flex-col h-screen sticky top-0 bg-[#050505]">
      <div className="p-6">
        <div className="flex items-center gap-3 text-blue-500 mb-8">
          <ShieldCheck className="w-8 h-8" />
          <span className="font-black text-xl tracking-tighter text-white">T1D HUB</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                  isActive 
                    ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]" 
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-600 group-hover:text-blue-400")} />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:text-white hover:bg-white/5 w-full transition-all">
          <Settings className="w-5 h-5" />
          Settings
        </button>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500/70 hover:text-red-400 hover:bg-red-500/5 w-full transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
