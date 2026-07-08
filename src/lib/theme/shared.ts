export type Theme = 'light' | 'dark' | 'system'

export const THEME_COOKIE = 'theme'

export function normalizeTheme(value: string | undefined | null): Theme {
  return value === 'dark' ? 'dark' : value === 'light' ? 'light' : 'system'
}
