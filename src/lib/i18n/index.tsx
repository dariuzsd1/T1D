'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { en, fr, type TKey } from './dictionaries'

export type Lang = 'en' | 'fr'

export const LANG_COOKIE = 'lang'
const ONE_YEAR = 60 * 60 * 24 * 365

const DICTS: Record<Lang, Record<TKey, string>> = { en, fr }

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Translate a key, with optional `{placeholder}` interpolation. */
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

/** Normalize any cookie/string value to a supported language, defaulting to English. */
export function normalizeLang(value: string | undefined | null): Lang {
  return value === 'fr' ? 'fr' : 'en'
}

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: ReactNode
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    if (typeof document !== 'undefined') {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${ONE_YEAR}; samesite=lax`
      // Keep <html lang> in sync so the browser stops offering to auto-translate.
      document.documentElement.lang = l
    }
  }, [])

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let s: string = DICTS[lang][key] ?? DICTS.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return s
    },
    [lang]
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within a LanguageProvider')
  return ctx
}
