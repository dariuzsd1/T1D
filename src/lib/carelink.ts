/**
 * CareLink CSV parser — Phase 4 (CLAUDE.md §9: "never auto-merge medical data").
 *
 * Medtronic's CareLink portal lets users export their own data as a CSV. This
 * module parses that file locally in the browser, counts recognised device events
 * (reservoir changes, sensor insertions, infusion site changes), and hands back a
 * summary for the user to review BEFORE anything is written to the database.
 *
 * Nothing in this file writes to Supabase — that is intentionally the caller's job
 * so the "review before apply" gate can never be bypassed.
 *
 * Supported format: CareLink Personal CSV (the "Raw-Type" column identifies events).
 * Unrecognised rows are silently skipped — never guessed, never fabricated.
 */

export type CareLinkEventKind = 'reservoir' | 'sensor' | 'infusion_set'

/** Per-kind summary returned to the UI for the review table. */
export interface CareLinkKindSummary {
  kind: CareLinkEventKind
  count: number
  firstDate: string | null
  lastDate: string | null
}

export interface CareLinkSummary {
  /** Kinds that had at least one recognised event. */
  recognized: CareLinkKindSummary[]
  /** Which format was detected; 'unknown' means we could not identify the file. */
  format: 'carelink-personal' | 'unknown'
  /** Total data rows attempted (excluding the header). */
  dataRows: number
  /** Rows that were unrecognised / skipped. */
  skippedRows: number
}

// ── Event classification ──────────────────────────────────────────────────────

// These Raw-Type strings appear in CareLink Personal CSV exports.
// All comparisons are upper-cased + trimmed so format drift doesn't break them.
const RESERVOIR_TYPES = new Set([
  'RESERVOIR_CHANGE',
  'RESERVOIR_CHANGE_REWIND',
  'RESERVOIR_FILLED',
])

const SENSOR_TYPES = new Set([
  'SENSOR_INSERT',
  'SENSOR_INSERTED',
  'SENSOR_START',
  'SENSOR_WARMUP',
])

const INFUSION_TYPES = new Set([
  'INFUSION_CHANGE',
  'INFUSION_SITE_CHANGE',
  'PRIME',
  'PRIME_INFUSION_TUBING',
])

function classifyRawType(raw: string): CareLinkEventKind | null {
  const upper = raw.toUpperCase().trim()
  if (RESERVOIR_TYPES.has(upper)) return 'reservoir'
  if (SENSOR_TYPES.has(upper)) return 'sensor'
  if (INFUSION_TYPES.has(upper)) return 'infusion_set'
  return null
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC 4180-compliant CSV line parser. Handles double-quoted fields and
 * embedded commas. Does not handle embedded newlines (not needed for CareLink).
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside a quoted field ("" → ")
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  fields.push(current.trim())
  return fields
}

/**
 * Scan the first 20 lines for a row that contains "Raw-Type" as a column header.
 * Returns the column indices we care about, or null if the file isn't recognised.
 */
function detectColumns(lines: string[]): {
  headerIdx: number
  rawTypeCol: number
  dateCol: number
  timestampCol: number
} | null {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const row = parseCsvLine(lines[i])
    // Normalise: lower-case, strip non-alphanumeric so "Raw-Type" === "rawtype"
    const norm = row.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''))

    const rawTypeCol = norm.findIndex(c => c === 'rawtype')
    if (rawTypeCol === -1) continue

    const dateCol = norm.findIndex(c => c === 'date')
    const timestampCol = norm.findIndex(
      c => c.startsWith('timestamp') || c === 'datetime'
    )

    return { headerIdx: i, rawTypeCol, dateCol, timestampCol }
  }
  return null
}

/** Extract a YYYY-MM-DD string from whatever date-ish field is available. */
function extractDate(row: string[], dateCol: number, timestampCol: number): string {
  if (dateCol !== -1 && row[dateCol]) {
    const raw = row[dateCol].trim()
    if (raw) return raw
  }
  if (timestampCol !== -1 && row[timestampCol]) {
    // ISO timestamp → take date part
    const raw = row[timestampCol].trim()
    if (raw) return raw.split('T')[0]
  }
  return ''
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a CareLink Personal CSV export and return a summary of recognised device
 * events, grouped by kind. Does NOT write anything — the caller decides what to
 * apply after the user reviews.
 */
export function parseCareLink(csvText: string): CareLinkSummary {
  const lines = csvText.split(/\r?\n/)

  const cols = detectColumns(lines)
  if (!cols) {
    return {
      recognized: [],
      format: 'unknown',
      dataRows: 0,
      skippedRows: lines.length,
    }
  }

  const { headerIdx, rawTypeCol, dateCol, timestampCol } = cols
  const dataLines = lines.slice(headerIdx + 1)

  let dataRows = 0
  let skippedRows = 0

  const countByKind: Partial<Record<CareLinkEventKind, number>> = {}
  const datesByKind: Partial<Record<CareLinkEventKind, string[]>> = {}

  for (const line of dataLines) {
    if (!line.trim()) continue
    dataRows++

    const row = parseCsvLine(line)
    const rawType = row[rawTypeCol]?.trim() ?? ''
    if (!rawType) { skippedRows++; continue }

    const kind = classifyRawType(rawType)
    if (!kind) { skippedRows++; continue }

    countByKind[kind] = (countByKind[kind] ?? 0) + 1

    const date = extractDate(row, dateCol, timestampCol)
    if (date) {
      if (!datesByKind[kind]) datesByKind[kind] = []
      datesByKind[kind]!.push(date)
    }
  }

  const ORDER: CareLinkEventKind[] = ['reservoir', 'sensor', 'infusion_set']
  const recognized: CareLinkKindSummary[] = ORDER
    .filter(k => (countByKind[k] ?? 0) > 0)
    .map(k => {
      const dates = [...new Set(datesByKind[k] ?? [])].sort()
      return {
        kind: k,
        count: countByKind[k]!,
        firstDate: dates[0] ?? null,
        lastDate: dates[dates.length - 1] ?? null,
      }
    })

  return {
    recognized,
    format: 'carelink-personal',
    dataRows,
    skippedRows,
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const EVENT_KIND_LABEL: Record<CareLinkEventKind, string> = {
  reservoir: 'Reservoir changes',
  sensor: 'Sensor insertions',
  infusion_set: 'Infusion site changes',
}

// Prefer `t(EVENT_KIND_KEY[kind])` in the UI; EVENT_KIND_LABEL is the English fallback.
export const EVENT_KIND_KEY: Record<CareLinkEventKind, import('./i18n/dictionaries').TKey> = {
  reservoir: 'eventKind.reservoir',
  sensor: 'eventKind.sensor',
  infusion_set: 'eventKind.infusionSet',
}

/**
 * Keyword hints for auto-matching a CareLink event kind to a supply in inventory.
 * Try these against supply name + brand (case-insensitive). First match wins.
 */
export const KIND_SUPPLY_KEYWORDS: Record<CareLinkEventKind, string[]> = {
  reservoir: ['reservoir'],
  sensor: ['sensor', 'guardian', 'simplera', 'enlite'],
  infusion_set: ['infusion', 'quickset', 'mio', 'silhouette', 'autosoft', 'set'],
}

/** Format a YYYY-MM-DD as "Jun 17" for compact display. */
export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00') // noon avoids DST day shifts
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
