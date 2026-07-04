'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Activity, Package, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { useProfile } from '@/components/profile/ProfileProvider'
import { logActivity } from '@/lib/activity'
import { createSupplies } from '@/lib/addSupply'
import { deviceToRow } from '@/lib/devices'
import {
  DELIVERY_OPTIONS, CGM_OPTIONS, kitSupplies, kitDevices, type KitOption,
} from '@/lib/starterKits'

/**
 * First-run onboarding. Reuses the Quick Start pump/CGM picker: the user's picks
 * bulk-add the standard consumables AND register the pump/CGM in `medical_devices`
 * (completing the supply + device setup steps in one pass). Nothing is auto-picked
 * for the user. Finishing OR skipping sets `profiles.onboarding_completed_at` so
 * this never auto-shows again (best-effort — works before the migration is run).
 */
export default function OnboardingPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { t } = useI18n()
  const { refresh } = useProfile()
  const { addProduct } = useStore()

  const [deliveryId, setDeliveryId] = useState<string | null>(null)
  const [cgmId, setCgmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supplies = kitSupplies(deliveryId, cgmId)

  const markComplete = async (userId: string) => {
    const { error: e } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', userId)
    if (e) console.warn('onboarding flag not saved — run supabase/setup.sql:', e.message)
    // Session fallback so a pre-migration skip doesn't redirect-loop back here.
    // The DB flag is the real gate; this only suppresses the redirect until the
    // column exists (see the dashboard's first-run effect).
    try { sessionStorage.setItem('t1d-onboarding-done', '1') } catch { /* private mode */ }
    await refresh()
  }

  const handleFinish = async () => {
    if (supplies.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) { setError(t('onboarding.error')); setSaving(false); return }

      // Register the picked pump/CGM as devices (best-effort → completes the
      // "device" setup step). A failure here must never block adding supplies.
      const devices = kitDevices(deliveryId, cgmId)
      if (devices.length > 0) {
        const { error: devErr } = await supabase
          .from('medical_devices')
          .insert(devices.map((d) => ({ user_id: user.id, ...deviceToRow(d) })))
        if (devErr) console.warn('onboarding devices not saved:', devErr.message)
      }

      const created = await createSupplies(
        supabase,
        user.id,
        supplies.map((s) => ({
          name: s.name, brand: s.brand, category: s.category,
          quantity: s.unitsPerBox, usageRatePerDay: s.usageRatePerDay,
        })),
      )
      created.forEach((p) => { addProduct(p); void logActivity('supply_added', p.name) })

      await markComplete(user.id)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.error'))
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setSkipping(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) await markComplete(user.id)
    router.push('/dashboard')
  }

  const busy = saving || skipping

  return (
    <div className="max-w-lg mx-auto py-4">
      <header className="text-center mb-8">
        <p className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('onboarding.kicker')}</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('onboarding.title')}</h1>
        <p className="text-muted mt-3 leading-relaxed">{t('onboarding.subtitle')}</p>
      </header>

      <PickerGroup
        title={t('onboarding.delivery')}
        Icon={Zap}
        options={DELIVERY_OPTIONS}
        selected={deliveryId}
        onSelect={(id) => setDeliveryId((p) => (p === id ? null : id))}
      />
      <PickerGroup
        title={t('onboarding.cgm')}
        Icon={Activity}
        options={CGM_OPTIONS}
        selected={cgmId}
        onSelect={(id) => setCgmId((p) => (p === id ? null : id))}
      />

      {supplies.length > 0 && (
        <div className="mt-6 rounded-2xl bg-surface-2 border border-line p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> {t('onboarding.willAdd')}
          </p>
          <ul className="space-y-1.5">
            {supplies.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{s.name}</span>
                <span className="text-muted text-xs">
                  {t('onboarding.perBox', { n: s.unitsPerBox })}
                  {s.usageRatePerDay > 0 && ` · ${t('onboarding.daysEach', { n: Math.round(1 / s.usageRatePerDay) })}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
          {error}
        </div>
      )}

      <button
        onClick={handleFinish}
        disabled={busy || supplies.length === 0}
        className="mt-6 w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {supplies.length === 0 ? t('onboarding.pickPrompt') : t('onboarding.finish')}
      </button>

      <div className="mt-3 text-center">
        <button
          onClick={handleSkip}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
        >
          {skipping && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('onboarding.skip')}
        </button>
      </div>
    </div>
  )
}

function PickerGroup({
  title, Icon, options, selected, onSelect,
}: {
  title: string
  Icon: typeof Zap
  options: KitOption[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-2.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = selected === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              aria-pressed={active}
              className={`relative text-left rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active ? 'border-primary bg-primary/5' : 'border-line bg-surface hover:border-primary/40'
              }`}
            >
              {active && (
                <span className="absolute top-2 right-2 text-primary"><Check className="w-4 h-4" /></span>
              )}
              <p className="font-semibold text-ink text-sm leading-tight pr-5">{opt.label}</p>
              {opt.sublabel && <p className="text-faint text-xs mt-0.5">{opt.sublabel}</p>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
