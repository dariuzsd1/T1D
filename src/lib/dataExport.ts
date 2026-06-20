import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Export my data" — gather every row the signed-in user owns and hand it back
 * as one JSON document they can download. A data-rights feature for a health app.
 *
 * The async gather lives here; the document assembly + filename are pure so they
 * can be unit-tested without a database.
 */

/** Each owned table and the column that scopes it to the current user. */
export const EXPORT_SOURCES: { table: string; column: string }[] = [
  { table: 'profiles', column: 'id' },
  { table: 'supplies', column: 'user_id' },
  { table: 'site_changes', column: 'user_id' },
  { table: 'prescriptions', column: 'user_id' },
  { table: 'appointments', column: 'user_id' },
  { table: 'medical_devices', column: 'user_id' },
  { table: 'medical_profiles', column: 'user_id' },
  { table: 'caregiver_shares', column: 'owner_id' },
  { table: 'notification_prefs', column: 'user_id' },
]

export interface ExportDocument {
  app: string
  exportedAt: string
  account: { id: string; email: string | null }
  data: Record<string, unknown[]>
}

/** Pure: assemble the downloadable document from already-fetched table rows. */
export function buildExportDocument(
  account: { id: string; email: string | null },
  tables: Record<string, unknown[]>,
  exportedAt: string
): ExportDocument {
  return { app: 'T1D Supply Hub', exportedAt, account, data: tables }
}

/** Pure: a dated filename like `t1d-hub-export-2026-06-20.json`. */
export function exportFilename(d: Date = new Date()): string {
  const iso = d.toISOString().split('T')[0]
  return `t1d-hub-export-${iso}.json`
}

/**
 * Fetch every owned row under RLS. Best-effort per table: a missing table or
 * error yields [] rather than failing the whole export.
 */
export async function gatherUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  for (const { table, column } of EXPORT_SOURCES) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq(column, userId)
      out[table] = error ? [] : (data ?? [])
    } catch {
      out[table] = []
    }
  }
  return out
}

/** Browser-only: trigger a download of `obj` as pretty-printed JSON. */
export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
