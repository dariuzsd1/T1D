'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * TanStack Query POC (Home + Supplies pages only — see BACKLOG.md). One
 * QueryClient per browser session, created lazily via useState so it survives
 * re-renders but never leaks across users/requests (the Next.js App Router
 * "one client per component instance" pattern, since this file only ever
 * mounts client-side).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
