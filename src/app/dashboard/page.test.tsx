// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import { useStore, type Product } from '@/lib/store'
import { effectiveRunwayDays } from '@/lib/depletion'

/**
 * Home's smoke render — the last significant uncovered surface in BACKLOG.md.
 *
 * Mounting the real page, not a stripped-down copy, so this catches what unit
 * tests cannot: a provider wired wrong, a missing i18n key, a crash on first
 * paint. The plumbing the page reaches for on mount is stubbed and nothing else
 * is: the ranking, status and copy decisions all run for real.
 *
 * Its first job is the bug that prompted it. Home ranks the inventory to pick
 * `mostUrgent`, and `mostUrgent` is what the single reorder button points at.
 * Ranking used to be by `remainingDays`, which for a rescue item is the 1-a-day
 * fallback, so a glucagon pen good for another fifty days beat pods running out
 * in three and captured the only action on the screen.
 */

// The router: Home can redirect a genuinely empty account into onboarding. The
// fixtures below are never empty, so this should stay unused — asserted below,
// because a silent redirect would leave an empty DOM and pass everything.
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard',
}))

// Supabase: used by the page for appointments/prescriptions/device-count and by
// ProfileProvider for the signed-in user. Returns empty sets, which the page is
// explicitly built to tolerate (the What's Next section just hides).
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 't@example.com' } } }) },
    from: () => {
      const result = Promise.resolve({ data: [], error: null, count: 0 })
      const chain = {
        select: () => chain,
        order: () => result,
        eq: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: result.then.bind(result),
      }
      return chain
    },
  }),
}))

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), logActivity: vi.fn() }))

// Stubbed rather than wrapped in a QueryClientProvider: the fetch itself is not
// what is under test here, and the store is seeded directly instead.
vi.mock('@/lib/useInventory', () => ({
  useInventory: () => ({ isLoading: false, error: null, data: undefined }),
}))

import DashboardPage from './page'

const DAY = 86400000
const isoInDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)

const product = (p: Partial<Product> & { name: string }): Product => {
  const base = {
    id: p.name, brand: '', category: 'unknown', quantity: 1, usageRatePerDay: 0,
    lastScanned: isoInDays(0), expirationDate: null, remainingDays: 0, ...p,
  } as Product
  return { ...base, remainingDays: effectiveRunwayDays(base) }
}

/** Pods run out in 3 days. The glucagon is good for another 50. */
const PODS = product({ name: 'Omnipod 5 Pod', category: 'patch_pump', quantity: 1, usageRatePerDay: 0.33 })
const GLUCAGON = product({
  name: 'Gvoke HypoPen', category: 'glucagon', quantity: 1, usageRatePerDay: 0,
  expirationDate: isoInDays(50),
})

const seed = (items: Product[]) => useStore.getState().setInventory(items)

describe('Home smoke render', () => {
  beforeEach(() => {
    replace.mockClear()
    seed([])
  })

  it('renders without crashing and does not bounce a non-empty account to onboarding', async () => {
    seed([PODS])
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText(/needs attention|need attention/i)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('points its one reorder button at what is actually running out', async () => {
    // Both are 'low', so both reach the list; the order decides the CTA. Seeded
    // glucagon-first so a stable sort cannot produce the right answer by luck.
    seed([GLUCAGON, PODS])
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByRole('link', { name: /reorder omnipod 5 pod/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /reorder gvoke/i })).not.toBeInTheDocument()
  })

  it('counts both items as needing attention', async () => {
    seed([GLUCAGON, PODS])
    renderWithProviders(<DashboardPage />)
    // The ranking fix must not change WHICH items qualify, only their order.
    expect(await screen.findByText(/2 supplies need attention/i)).toBeInTheDocument()
  })

  it('still leads with a rescue med that is about to lapse', async () => {
    // The flip side has to keep working: expiry really is the clock for these.
    seed([product({ name: 'Dexcom G7 Sensor', category: 'cgm_sensor', quantity: 9, usageRatePerDay: 0.1 }),
          product({ name: 'Gvoke HypoPen', category: 'glucagon', quantity: 1, usageRatePerDay: 0, expirationDate: isoInDays(10) })])
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByRole('link', { name: /reorder gvoke/i })).toBeInTheDocument()
  })
})
