'use client'

import Link from 'next/link'
import { ShoppingCart, Stethoscope, Pill, ChevronRight } from 'lucide-react'
import { type AgendaItem, type AgendaKind, formatAgendaDate } from '@/lib/homeAgenda'
import { useI18n } from '@/lib/i18n'

/**
 * "What's Next" — a compact, glanceable list of the next real dated things
 * (refill-eligible, appointment, prescription renewal). Calm Clinical: neutral
 * surface, one accent, no red, no dense table. Renders nothing when empty so the
 * home page never shows a broken-looking empty shell (CLAUDE.md §6/§9).
 */

const KIND_ICON: Record<AgendaKind, typeof ShoppingCart> = {
  refill: ShoppingCart,
  appointment: Stethoscope,
  prescription: Pill,
}

export function WhatsNext({ items, now }: { items: AgendaItem[]; now?: Date }) {
  const { t } = useI18n()
  if (items.length === 0) return null

  return (
    <section aria-labelledby="whats-next-heading" className="bg-surface border border-line rounded-3xl p-5 sm:p-6">
      <h2
        id="whats-next-heading"
        className="text-xs font-semibold uppercase tracking-widest text-muted mb-3"
      >
        {t('whatsNext.title')}
      </h2>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind]
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex items-center gap-3.5 py-3 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg -mx-1 px-1"
              >
                <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 font-medium text-ink truncate">{item.label}</span>
                <span className="shrink-0 text-sm font-semibold text-muted tabular-nums">
                  {formatAgendaDate(item.date, now)}
                </span>
                <ChevronRight className="w-4 h-4 text-faint group-hover:text-primary transition-colors shrink-0" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
