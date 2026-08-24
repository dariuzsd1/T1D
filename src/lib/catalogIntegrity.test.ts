import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the product catalog's own bookkeeping.
 *
 * The accuracy pass established one rule: a row is only marked verified when a
 * real source was actually read. These assertions make that rule enforceable
 * instead of a habit, and they catch the mistakes that pass review because the
 * text still looks plausible.
 *
 * Deliberately NOT a staleness failure. A test that starts failing on a date,
 * with no code change, breaks an unrelated pull request and teaches people to
 * ignore it. Staleness is reported to the console instead, where it is visible
 * in CI without holding anyone hostage.
 */
interface Row { [k: string]: string }

const csv = readFileSync(join(process.cwd(), 'data/diabetes_catalog.csv'), 'utf8')

/** Minimal CSV reader: handles the quoted fields this file actually uses. */
function parse(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/)
  const cols = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cells: string[] = []
    let cur = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { quoted = !quoted; continue }
      if (c === ',' && !quoted) { cells.push(cur); cur = ''; continue }
      cur += c
    }
    cells.push(cur)
    return Object.fromEntries(cols.map((k, i) => [k, cells[i] ?? ''])) as Row
  })
}

const rows = parse(csv)
const named = (rs: Row[]) => rs.map((r) => r.product_name)

describe('product catalog integrity', () => {
  it('has rows to check', () => {
    expect(rows.length).toBeGreaterThan(100)
  })

  it('never claims a row is verified without naming the source', () => {
    expect(named(rows.filter((r) => r.last_verified && !r.source_url))).toEqual([])
  })

  it('has only real, non-future verification dates', () => {
    const today = new Date().toISOString().slice(0, 10)
    const broken = rows.filter((r) => {
      if (!r.last_verified) return false
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.last_verified)) return true
      return r.last_verified > today
    })
    expect(named(broken)).toEqual([])
  })

  it('explains every discontinued product in its notes', () => {
    // A flag with no reason is unauditable: nobody can tell later whether it was
    // researched or guessed, and it stops the app suggesting a reorder.
    const unexplained = rows.filter(
      (r) => r.discontinued && !/DISCONTINUED|no longer/i.test(r.notes),
    )
    expect(named(unexplained)).toEqual([])
  })

  it('keeps product names and GTINs unique', () => {
    const names = named(rows)
    expect(named(rows.filter((r) => names.filter((n) => n === r.product_name).length > 1))).toEqual([])
    const gtins = rows.map((r) => r.gtin).filter(Boolean)
    expect(named(rows.filter((r) => r.gtin && gtins.filter((g) => g === r.gtin).length > 1))).toEqual([])
  })

  it('keeps usage rates numeric', () => {
    const bad = rows.filter((r) => r.typical_usage_per_day && Number.isNaN(Number(r.typical_usage_per_day)))
    expect(named(bad)).toEqual([])
  })

  it('reports how stale the verified rows are getting', () => {
    const MONTHS = 12
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - MONTHS)
    const iso = cutoff.toISOString().slice(0, 10)
    const verified = rows.filter((r) => r.last_verified)
    const stale = verified.filter((r) => r.last_verified < iso)
    // Brand ownership changes and discontinuations rot silently, which is exactly
    // what this pass kept finding. Visible beats enforced here.
    console.log(
      `catalog: ${verified.length}/${rows.length} verified, ` +
        `${rows.length - verified.length} never verified, ` +
        `${stale.length} verified over ${MONTHS} months ago`,
    )
    if (stale.length) console.log('  oldest:', stale.slice(0, 5).map((r) => `${r.product_name} (${r.last_verified})`).join(', '))
    expect(verified.length).toBeGreaterThan(0)
  })
})
