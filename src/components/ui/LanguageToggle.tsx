'use client'

import { useI18n, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
]

/**
 * Compact English/French/Spanish switcher. Writes the choice to a cookie (via
 * the provider) so it persists and is read server-side on the next load.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('settings.language')}
      className={cn('inline-flex rounded-xl bg-surface-2 border border-line p-1 gap-1', className)}
    >
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            lang === code ? 'bg-surface shadow-sm text-ink' : 'text-muted hover:text-ink'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
