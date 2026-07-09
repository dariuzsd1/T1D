'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

/**
 * Compact Light/Dark/System switcher, same segmented-control shape as
 * LanguageToggle. Writes the choice to a cookie (via the provider) so it
 * persists and is read server-side on the next load, with zero flash.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()

  const labelFor: Record<Theme, string> = {
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
    system: t('settings.themeSystem'),
  }

  return (
    <div
      role="group"
      aria-label={t('settings.theme')}
      className={cn('inline-flex rounded-xl bg-surface-2 border border-line p-1 gap-1', className)}
    >
      {THEMES.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          aria-label={labelFor[value]}
          title={labelFor[value]}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            theme === value ? 'bg-surface shadow-sm text-ink' : 'text-muted hover:text-ink'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {labelFor[value]}
        </button>
      ))}
    </div>
  )
}
