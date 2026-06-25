export type Lang = 'en' | 'fr'

export const LANG_COOKIE = 'lang'

export function normalizeLang(value: string | undefined | null): Lang {
  return value === 'fr' ? 'fr' : 'en'
}
