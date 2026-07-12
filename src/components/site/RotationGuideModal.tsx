'use client'

import { motion } from 'framer-motion'
import { X, RotateCcw, ExternalLink } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/dictionaries'

// Reference sources for the guidance above: a recognized authority (the primary
// "Learn more") plus the two pages the user pointed us to.
const AUTHORITY_URL =
  'https://www.diabetes.org.uk/about-diabetes/looking-after-diabetes/treatments/insulin/injecting'
const SOURCE_LINKS = [
  { label: 'clinidiabet.com', url: 'https://clinidiabet.com/en/infodiabetes/education/treatment/insulin/10.htm' },
  { label: 'fiercelydiabetic.com', url: 'https://fiercelydiabetic.com/tools/site-rotation.html' },
]

/**
 * "How to rotate your sites" — a short, accessible education dialog. Content is
 * grounded in standard site-rotation guidance (spacing, resting a spot, matching
 * the site to the dose, areas to avoid, lipohypertrophy). Mirrors the other
 * dialogs (useDialog: focus trap, Escape, focus restore, scroll lock). Renders
 * general education only, never per-user medical advice.
 */
const TIPS: { n: number; title: TKey; body: TKey }[] = [
  { n: 1, title: 'rotationGuide.tip1Title', body: 'rotationGuide.tip1Body' },
  { n: 2, title: 'rotationGuide.tip2Title', body: 'rotationGuide.tip2Body' },
  { n: 3, title: 'rotationGuide.tip3Title', body: 'rotationGuide.tip3Body' },
  { n: 4, title: 'rotationGuide.tip4Title', body: 'rotationGuide.tip4Body' },
  { n: 5, title: 'rotationGuide.tip5Title', body: 'rotationGuide.tip5Body' },
]

export function RotationGuideModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const dialogRef = useDialog<HTMLDivElement>(onClose)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rotation-guide-title"
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-teal" />
            </div>
            <div>
              <h2 id="rotation-guide-title" className="text-xl font-bold text-ink leading-tight">
                {t('rotationGuide.title')}
              </h2>
              <p className="text-sm text-muted">{t('rotationGuide.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="divide-y divide-line">
          {TIPS.map((tip) => (
            <li key={tip.n} className="flex gap-3.5 py-3.5">
              <span
                aria-hidden="true"
                className="shrink-0 w-8 h-8 rounded-lg bg-teal/10 text-teal font-bold text-sm flex items-center justify-center"
              >
                {tip.n}
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-ink mb-0.5">{t(tip.title)}</h3>
                <p className="text-sm text-muted leading-relaxed">{t(tip.body)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-4 border-t border-line space-y-2.5">
          <a
            href={AUTHORITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded"
          >
            {t('rotationGuide.learnMore')}
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <p className="text-xs text-faint">
            {t('rotationGuide.sources')}{' '}
            {SOURCE_LINKS.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ', '}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded"
                >
                  {s.label}
                </a>
              </span>
            ))}
          </p>
          <p className="text-xs text-faint">{t('rotationGuide.disclaimer')}</p>
        </div>
      </motion.div>
    </div>
  )
}
