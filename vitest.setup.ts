import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

/**
 * Providers that components need (ProfileProvider in particular) construct a
 * Supabase client and fetch on mount. Component tests are about rendering, not
 * about the network, so the client is stubbed once here rather than in every
 * file. Route-handler tests mock the SERVER client separately and are unaffected.
 */
vi.mock('@/lib/supabase/client', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'not', 'order', 'limit', 'insert', 'update', 'delete']) {
    builder[m] = () => builder
  }
  builder.single = async () => ({ data: null, error: null })
  builder.maybeSingle = async () => ({ data: null, error: null })
  builder.then = (res: (v: { data: unknown; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(res)
  return {
    createClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => builder,
    }),
  }
})
