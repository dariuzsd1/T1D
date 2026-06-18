'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing, BellOff, Loader2, Database } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { isMissingTableError } from '@/lib/prescriptions'
import {
  isPushSupported,
  registerAndGetToken,
  onForegroundMessage,
} from '@/lib/firebase/messaging'

type State =
  | 'checking'
  | 'unsupported'
  | 'default' // supported, not yet enabled
  | 'denied'
  | 'enabled'
  | 'working'
  | 'needs-migration'

export function PushToggle() {
  const { showToast } = useToast()
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    let unsub = () => {}
    let active = true

    ;(async () => {
      const supported = await isPushSupported()
      if (!active) return
      if (!supported) {
        setState('unsupported')
        return
      }
      const perm = Notification.permission
      setState(perm === 'denied' ? 'denied' : perm === 'granted' ? 'enabled' : 'default')

      // Show foreground messages as in-app toasts (the SW only handles background).
      unsub = await onForegroundMessage((title, body) =>
        showToast(body ? `${title} — ${body}` : title, 'info')
      )
    })()

    return () => {
      active = false
      unsub()
    }
  }, [showToast])

  const enable = async () => {
    setState('working')
    try {
      const token = await registerAndGetToken()
      if (!token) {
        const blocked = Notification.permission === 'denied'
        setState(blocked ? 'denied' : 'default')
        showToast(
          blocked ? 'Notifications are blocked in your browser.' : 'Notifications were not enabled.',
          'caution'
        )
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setState('default')
        showToast('Please sign in again.', 'caution')
        return
      }

      // One row per device token; re-enabling on the same device is idempotent.
      const { error } = await supabase
        .from('fcm_tokens')
        .upsert({ user_id: user.id, token }, { onConflict: 'token' })

      if (error) {
        if (isMissingTableError(error)) {
          setState('needs-migration')
          return
        }
        setState('default')
        showToast(`Couldn’t save your device: ${error.message}`, 'caution')
        return
      }

      setState('enabled')
      showToast('Notifications are on for this device.', 'success')
    } catch (err: any) {
      setState('default')
      showToast(err?.message || 'Could not enable notifications.', 'caution')
    }
  }

  // --- States ---------------------------------------------------------------

  if (state === 'needs-migration') {
    return (
      <div className="rounded-2xl bg-surface-2 border border-line p-4 flex gap-3 text-sm text-muted leading-relaxed">
        <Database className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
        <p>
          Almost there — the table that stores your device needs to be created once.
          Run <span className="font-semibold text-ink">supabase/setup.sql</span> in your Supabase
          dashboard (see <span className="font-semibold text-ink">docs/DATABASE_SETUP.md</span>),
          then reload and try again.
        </p>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <div className="rounded-2xl bg-surface-2 border border-line p-4 flex gap-3 text-sm text-muted leading-relaxed">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
        <p>This browser doesn’t support push notifications. Try Chrome or Safari (on a phone, add the app to your home screen first).</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl bg-caution-soft border border-caution/20 p-4 flex gap-3 text-sm text-caution leading-relaxed">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Notifications are blocked. Turn them on for this site in your browser settings, then reload this page.</p>
      </div>
    )
  }

  if (state === 'enabled') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-success-soft border border-success/20 p-4 flex gap-3 text-sm text-success leading-relaxed">
          <BellRing className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-medium">Notifications are on for this device.</p>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          You’ll get alerts even when the app is closed. The daily refill check that
          decides <em>when</em> to alert runs on the server — that scheduled piece
          (Supabase <span className="font-medium">pg_cron</span> → Edge Function) is
          the last setup step in <span className="font-medium">docs/PUSH_NOTIFICATIONS.md</span>.
          To confirm delivery now, send a test message from the Firebase console.
        </p>
      </div>
    )
  }

  // 'default' or 'working'
  return (
    <button
      onClick={enable}
      disabled={state === 'working' || state === 'checking'}
      className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
    >
      {state === 'working' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
      {state === 'working' ? 'Enabling…' : 'Enable notifications on this device'}
    </button>
  )
}
