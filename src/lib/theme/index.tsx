'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { type Theme, THEME_COOKIE } from './shared'

export type { Theme } from './shared'
export { THEME_COOKIE, normalizeTheme } from './shared'

const ONE_YEAR = 60 * 60 * 24 * 365

interface ThemeValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

/**
 * Light/Dark/System toggle, mirroring the language system's shape exactly
 * (cookie for first-paint, no flash — see the root layout).
 *
 * "system" removes the `data-theme` attribute entirely rather than setting it
 * to the literal string, so the OS-preference media query in globals.css
 * governs on its own; "light"/"dark" set the attribute, which CSS gives
 * higher specificity than the media query, so it wins either direction.
 */
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme
  children: ReactNode
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    if (typeof document !== 'undefined') {
      document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${ONE_YEAR}; samesite=lax`
      if (t === 'system') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.dataset.theme = t
      }
    }
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
