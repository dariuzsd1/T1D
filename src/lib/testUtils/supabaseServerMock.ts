import { vi } from 'vitest'

/**
 * A minimal stand-in for the Supabase server client (src/lib/supabase/server.ts),
 * for route-handler tests. Mocks only what the inventory routes actually call:
 * `auth.getUser()` and `.from(table)....` fluent query chains.
 *
 * The query builder is deliberately loose about WHICH chain methods were called
 * (`.select().eq().order()` vs `.update().eq().eq()` vs `.insert().select().single()`)
 * — every chain method just returns the same builder, and the builder itself is
 * thenable, resolving to the canned `{ data, error }` for that table regardless of
 * how it was awaited (`await x.select()...` or `await x.single()`/`.maybeSingle()`).
 * That's enough to test the ROUTE's status-code/shape branching without re-testing
 * Supabase's own query builder.
 */
export function createSupabaseServerMock(opts: {
  user?: { id: string; email?: string } | null
  tables?: Record<string, { data?: unknown; error?: { message: string } | null }>
}) {
  const { user = null, tables = {} } = opts

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => {
      const result = tables[table] ?? { data: null, error: null }
      const builder: Record<string, unknown> = {}
      const chainable = ['select', 'eq', 'order', 'insert', 'update', 'delete', 'limit'] as const
      for (const method of chainable) {
        builder[method] = vi.fn(() => builder)
      }
      builder.single = vi.fn().mockResolvedValue(result)
      builder.maybeSingle = vi.fn().mockResolvedValue(result)
      // Makes the builder itself awaitable when no terminal method is called,
      // e.g. `await supabase.from(x).select('*').eq(...).order(...)`.
      builder.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject)
      return builder
    }),
  }
}
