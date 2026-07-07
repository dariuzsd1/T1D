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
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
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
        showToast(body ? t('push.foregroundMessage', { title, body }) : title, 'info')
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
      // Never spin forever: if the browser prompt is ignored or Google's token
      // request stalls, give up after 20s and let the user try again.
      const token = await Promise.race([
        registerAndGetToken(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(t('push.timeout'))), 20_000)
        ),
      ])
      if (!token) {
        const blocked = Notification.permission === 'denied'
        setState(blocked ? 'denied' : 'default')
        showToast(
          blocked ? t('push.blocked') : t('push.notEnabled'),
          'caution'
        )
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setState('default')
        showToast(t('common.pleaseSignInAgain'), 'caution')
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
        showToast(t('push.saveDeviceFail', { error: error.message }), 'caution')
        return
      }

      setState('enabled')
      showToast(t('push.enabledToast'), 'success')
    } catch (err: any) {
      setState('default')
      showToast(err?.message || t('push.enableFail'), 'caution')
    }
  }

  // --- States ---------------------------------------------------------------

  if (state === 'needs-migration') {
    return (
      <div className="rounded-2xl bg-surface-2 border border-line p-4 flex gap-3 text-sm text-muted leading-relaxed">
        <Database className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
        <p>
          {t('push.migrationBody')}
        </p>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <div className="rounded-2xl bg-surface-2 border border-line p-4 flex gap-3 text-sm text-muted leading-relaxed">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
        <p>{t('push.unsupportedBody')}</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl bg-caution-soft border border-caution/20 p-4 flex gap-3 text-sm text-caution leading-relaxed">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
        <p>{t('push.deniedBody')}</p>
      </div>
    )
  }

  if (state === 'enabled') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-success-soft border border-success/20 p-4 flex gap-3 text-sm text-success leading-relaxed">
          <BellRing className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-medium">{t('push.enabledTitle')}</p>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {t('push.enabledDetail')}
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
      {state === 'working' ? t('push.enabling') : t('push.enableBtn')}
    </button>
  )
}
