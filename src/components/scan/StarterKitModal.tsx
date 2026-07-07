'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { X, Loader2, Check, Zap, Activity, Package } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/lib/useDialog'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/activity'
import { createSupplies } from '@/lib/addSupply'
import { DELIVERY_OPTIONS, CGM_OPTIONS, kitSupplies, type KitOption } from '@/lib/starterKits'
import { useI18n } from '@/lib/i18n'

/**
 * Quick start: pick your insulin-delivery system and your CGM, and we add the
 * standard consumables for each in one tap, with real box counts and wear rates
 * already set. The fastest possible setup, with no typing and no barcode needed.
 */
export function StarterKitModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const { addProduct } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const router = useRouter()
  const dialogRef = useDialog<HTMLDivElement>(onClose)

  const [deliveryId, setDeliveryId] = useState<string | null>(null)
  const [cgmId, setCgmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supplies = kitSupplies(deliveryId, cgmId)

  const handleAdd = async () => {
    if (supplies.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setError(t('starterKit.errSignIn'))
        setSaving(false)
        return
      }
      const created = await createSupplies(
        supabase,
        user.id,
        supplies.map(s => ({
          name: s.name,
          brand: s.brand,
          category: s.category,
          quantity: s.unitsPerBox,
          usageRatePerDay: s.usageRatePerDay,
        })),
      )
      created.forEach(p => {
        addProduct(p)
        void logActivity('supply_added', p.name)
      })
      showToast(t(created.length === 1 ? 'starterKit.toastAddedOne' : 'starterKit.toastAddedOther', { count: created.length }), 'success')
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('starterKit.errGeneric'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/50" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kit-title"
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 id="kit-title" className="text-xl font-bold text-ink">{t('home.quickStart')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted mb-6">
          {t('onboarding.subtitle')}
        </p>

        <Group
          title={t('onboarding.delivery')}
          Icon={Zap}
          options={DELIVERY_OPTIONS}
          selected={deliveryId}
          onSelect={id => setDeliveryId(prev => (prev === id ? null : id))}
        />

        <Group
          title={t('onboarding.cgm')}
          Icon={Activity}
          options={CGM_OPTIONS}
          selected={cgmId}
          onSelect={id => setCgmId(prev => (prev === id ? null : id))}
        />

        {/* Live preview of what will be added */}
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
          onClick={handleAdd}
          disabled={saving || supplies.length === 0}
          className="mt-6 w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {supplies.length === 0
            ? t('onboarding.pickPrompt')
            : t(supplies.length === 1 ? 'starterKit.addCountOne' : 'starterKit.addCountOther', { count: supplies.length })}
        </button>
      </motion.div>
    </div>
  )
}

function Group({
  title,
  Icon,
  options,
  selected,
  onSelect,
}: {
  title: string
  Icon: typeof Zap
  options: KitOption[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-2.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => {
          const active = selected === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              aria-pressed={active}
              className={`relative text-left rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-line bg-surface hover:border-primary/40'
              }`}
            >
              {active && (
                <span className="absolute top-2 right-2 text-primary">
                  <Check className="w-4 h-4" />
                </span>
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
