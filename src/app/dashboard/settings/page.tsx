'use client'

import { useStore } from '@/lib/store'
import { DME_SUPPLIERS } from '@/lib/suppliers'
import { PushToggle } from '@/components/PushToggle'
import { Bell, ShieldCheck, ExternalLink, Truck } from 'lucide-react'

const BUFFER_PRESETS = [7, 14, 21, 30]

export default function SettingsPage() {
  const { safetyBufferDays, setSafetyBufferDays } = useStore()

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Settings</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Preferences</h1>
      </header>

      {/* Safety buffer — real, works now, persists locally */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Safety buffer</h3>
            <p className="text-sm text-muted">
              Flag a supply as &ldquo;reorder soon&rdquo; while you still have this many days of reserve left — so you&apos;re never racing to zero.
            </p>
          </div>
        </div>

        <div className="flex items-end gap-4 mb-5">
          <div className="text-5xl font-black tabular-nums text-ink">{safetyBufferDays}</div>
          <div className="text-sm font-medium text-muted pb-2">days of reserve</div>
        </div>

        <label htmlFor="buffer-range" className="sr-only">Safety buffer in days</label>
        <input
          id="buffer-range"
          type="range"
          min={1}
          max={45}
          value={safetyBufferDays}
          onChange={(e) => setSafetyBufferDays(parseInt(e.target.value, 10))}
          className="w-full accent-primary"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          {BUFFER_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => setSafetyBufferDays(d)}
              aria-pressed={safetyBufferDays === d}
              className={
                safetyBufferDays === d
                  ? 'px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white'
                  : 'px-4 py-2 rounded-xl text-sm font-semibold bg-surface-2 text-muted hover:text-ink transition-colors'
              }
            >
              {d} days
            </button>
          ))}
        </div>
      </section>

      {/* Notifications — honest: needs one-time setup, not yet live */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-caution-soft border border-caution/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-caution" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Push notifications</h3>
            <p className="text-sm text-muted">
              The most useful alerts reach you when the app is closed (&ldquo;Refill-eligible Thursday — tap to reorder&rdquo;).
            </p>
          </div>
        </div>
        <PushToggle />
      </section>

      {/* Quick supplier links — real, useful now */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Supplier shortcuts</h3>
            <p className="text-sm text-muted">Jump to a distributor to place or check on an order.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DME_SUPPLIERS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 border border-line px-4 py-3 text-sm font-semibold text-ink hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {s.label}
              <ExternalLink className="w-4 h-4 text-faint" />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
