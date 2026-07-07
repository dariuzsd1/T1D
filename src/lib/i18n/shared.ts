export type Lang = 'en' | 'fr' | 'es'

export const LANG_COOKIE = 'lang'

export function normalizeLang(value: string | undefined | null): Lang {
  return value === 'fr' ? 'fr' : value === 'es' ? 'es' : 'en'
}
