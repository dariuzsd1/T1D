'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import { isBiometricLockEnabled, verifyBiometricLock, disableBiometricLock } from '@/lib/biometricLock'
import { useI18n } from '@/lib/i18n'
import { useConfirm } from '@/components/ui/ConfirmDialog'

/**
 * Optional, per-device privacy screen (see src/lib/biometricLock.ts for the
 * full scope note: this is a convenience gate on top of the real Supabase
 * auth session, not a new security boundary). Off by default; renders
 * children immediately unless the user opted in on THIS specific device.
 *
 * Re-locks on every fresh mount of the dashboard layout (a real page load,
 * not a client-side navigation within the dashboard) — the same "every app
 * open needs Face ID" behavior as a banking app, deliberately conservative.
 */
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const confirm = useConfirm()
  // null = still checking localStorage (avoids a locked-screen flash for the
  // vast majority of users who never opted in).
  const [locked, setLocked] = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // localStorage doesn't exist during SSR, so this can't be a lazy useState
    // initializer without a server/client hydration mismatch: the server (and
    // the client's first hydration pass) must render "unlocked" either way,
    // then this effect corrects it a tick later for anyone who opted in — the
    // same accepted tradeoff any localStorage-driven UI (e.g. a theme toggle
    // without a cookie) makes. Deliberately excepted from the "no setState
    // directly in an effect" rule for that reason.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocked(isBiometricLockEnabled())
  }, [])

  const unlock = async () => {
    setVerifying(true)
    setFailed(false)
    const ok = await verifyBiometricLock()
    setVerifying(false)
    if (ok) setLocked(false)
    else setFailed(true)
  }

  // Safety net: if the enrolled biometric stops working (new phone, OS
  // credentials cleared, etc.) there would be no way back in — Settings,
  // where the toggle lives, is itself behind this same gate. Lets someone who
  // is truly stuck turn the lock off from the lock screen itself, after
  // confirming. This doesn't weaken security below what already exists:
  // anyone who could reach this screen could already clear the site's local
  // storage from the browser's own settings to the same effect.
  const resetOnThisDevice = async () => {
    const ok = await confirm({
      title: t('biometric.resetConfirmTitle'),
      body: t('biometric.resetConfirmBody'),
      confirmLabel: t('biometric.resetConfirmBtn'),
      tone: 'danger',
    })
    if (!ok) return
    disableBiometricLock()
    setLocked(false)
  }

  if (locked === null || locked === false) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[500] bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Fingerprint className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">{t('biometric.lockedTitle')}</h1>
          <p className="text-sm text-muted mt-1">{t('biometric.lockedBody')}</p>
        </div>
        {failed && (
          <p className="text-sm text-urgent font-medium" role="status">
            {t('biometric.failed')}
          </p>
        )}
        <button
          onClick={unlock}
          disabled={verifying}
          aria-label={t('biometric.unlockBtn')}
          className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('biometric.unlockBtn')}
        </button>
        <button
          type="button"
          onClick={resetOnThisDevice}
          className="text-sm text-muted hover:text-ink underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {t('biometric.resetLink')}
        </button>
      </div>
    </div>
  )
}
