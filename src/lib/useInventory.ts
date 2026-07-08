'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore, type Product } from './store'

async function fetchInventory(): Promise<Product[]> {
  const response = await fetch('/api/inventory')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const result = await response.json()
  return result.data || []
}

/**
 * Shared inventory fetch for Home + Supplies (TanStack Query POC — see
 * BACKLOG.md). Replaces each page's own fetch-on-mount effect with a cached,
 * deduplicated query: visiting Home then Supplies (or back) reuses the same
 * cached data for 30s instead of re-fetching, and it refetches on window
 * focus so a stale tab self-corrects.
 *
 * Deliberately does NOT replace the zustand store as the read model — it
 * write-throughs into `setInventory` on every successful fetch, so every
 * other component that reads `useStore().inventory` (RiskAlertBanner,
 * QuickActionHub, ProductCard's own mutations, etc., all mounted globally in
 * the dashboard layout) keeps working completely unchanged. This hook only
 * changes HOW Home/Supplies populate that store, not what reads from it.
 */
export function useInventory() {
  const { setInventory } = useStore()
  const query = useQuery({
    queryKey: ['inventory'],
    queryFn: fetchInventory,
  })

  useEffect(() => {
    if (query.data) setInventory(query.data)
    // setInventory is a stable zustand action reference; omitting it from deps
    // avoids an unnecessary re-run on every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data])

  return query
}
