'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { type SetupStep, setupDoneCount } from '@/lib/setupProgress'

/**
 * "Finish setup" nudge — a calm, informational onboarding checklist for accounts
 * that haven't finished setup. It fills the gap a fresh account leaves (no dated
 * events yet) with visible progress, and each step routes to where the missing
 * data is actually entered.
 *
 * Calm Clinical (§6): neutral surface, primary as the single accent, success only
 * for a completed step. NO red, NO amber (incomplete setup is not a warning), no
 * gamified badges/confetti. The parent renders this ONLY while setup is incomplete,
 * so completion is the dismissal — there's no close button.
 */
export function FinishSetup({ steps }: { steps: SetupStep[] }) {
  const done = setupDoneCount(steps)
  const total = steps.length

  return (
    <section
      aria-label={`Finish setup, ${done} of ${total} complete`}
      className="bg-surface border border-line rounded-3xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Finish setup</h2>
        <span className="text-xs font-semibold text-muted tabular-nums">
          {done} of {total}
        </span>
      </div>

      {/* Segmented progress — filled = primary, remaining = neutral surface. */}
      <div className="flex gap-1.5 mb-4" aria-hidden="true">
        {steps.map((s, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${s.done ? 'bg-primary' : 'bg-surface-2'}`}
          />
        ))}
      </div>

      <ul className="space-y-0.5">
        {steps.map((s) =>
          s.done ? (
            <div key={s.key} className="flex items-center gap-3 py-2 text-muted">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-hidden="true" />
              <span className="font-medium">{s.label}</span>
            </div>
          ) : (
            <li key={s.key}>
              <Link
                href={s.href}
                className="group flex items-center gap-3 py-2 rounded-lg -mx-1 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Circle className="w-5 h-5 text-faint shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 font-medium text-ink">{s.label}</span>
                <ChevronRight
                  className="w-4 h-4 text-faint group-hover:text-primary transition-colors shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          )
        )}
      </ul>
    </section>
  )
}
