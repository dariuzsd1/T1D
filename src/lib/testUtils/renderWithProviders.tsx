import type { ReactElement, ReactNode } from 'react'
import { afterEach } from 'vitest'
import { cleanup, render, type RenderOptions } from '@testing-library/react'
import { LanguageProvider } from '@/lib/i18n'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ProfileProvider } from '@/components/profile/ProfileProvider'

// Testing Library only auto-cleans when vitest runs with `globals: true`, and
// this project does not. Without this, one test's DOM survives into the next and
// assertions quietly pass or fail against a stale render.
afterEach(cleanup)

/**
 * Renders a component inside the providers the app actually mounts, so a test
 * exercises the real thing rather than a stripped-down copy that can drift from
 * it. Language is pinned to English so assertions can match on visible copy.
 */
function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider initialLang="en">
      <ProfileProvider>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </ProfileProvider>
    </LanguageProvider>
  )
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Providers, ...options })
}

export * from '@testing-library/react'
