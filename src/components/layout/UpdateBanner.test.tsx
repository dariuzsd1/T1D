// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import { UpdateBanner } from './UpdateBanner'

/**
 * The banner is the only thing telling a tab that has been open for days that a
 * deploy has happened. If it stops appearing, deploys silently stop reaching
 * people again, which is exactly the failure it was written to end.
 */
function mockVersion(buildId: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ buildId }) })))
}

/** Past the 3s settle delay, flushing the fetch promise chain as it goes. */
const settle = () => vi.advanceTimersByTimeAsync(3500)

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('UpdateBanner', () => {
  it('offers a reload when the server is serving a different build', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'old-commit')
    mockVersion('new-commit')
    renderWithProviders(<UpdateBanner />)
    await settle()
    expect(screen.getByText(/new version of the app is available/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('stays out of the way when the build already matches', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'same-commit')
    mockVersion('same-commit')
    renderWithProviders(<UpdateBanner />)
    await settle()
    expect(screen.queryByRole('button', { name: /reload/i })).not.toBeInTheDocument()
  })

  it('never nags during local development', async () => {
    // Both sides read 'dev' locally, so a prompt there would always be wrong.
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'dev')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    renderWithProviders(<UpdateBanner />)
    await settle()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stays silent when the check fails, rather than warning about nothing', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'old-commit')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    renderWithProviders(<UpdateBanner />)
    await settle()
    expect(screen.queryByRole('button', { name: /reload/i })).not.toBeInTheDocument()
  })

  it('can be dismissed', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'old-commit')
    mockVersion('new-commit')
    renderWithProviders(<UpdateBanner />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /dismiss the update notice/i }))
    expect(screen.queryByRole('button', { name: /^reload$/i })).not.toBeInTheDocument()
  })
})
