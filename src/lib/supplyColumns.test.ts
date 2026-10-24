import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { supplyColumns, COLUMN_OF, type SupplyFacts } from './supplyColumns'

/**
 * The guard for the bug this codebase kept making.
 *
 * Both intake paths insert the core columns and then write the optional ones in
 * a best-effort follow-up update. Each used to hand-roll its own payload, and
 * they drifted every time a column was added -- silently, because a missing
 * optional column just reads NULL. Six instances, every one found by querying a
 * real database rather than by running this suite:
 *
 *   in_use_days, catalog_refill_interval_days, usage_rate_per_day, category,
 *   discontinued, and the kit product names themselves.
 *
 * Three assertions below, each closing a different way back in:
 *   1. every declared fact maps to a column (add a field, must map it);
 *   2. a fully-populated set of facts produces every column (no silent drop);
 *   3. neither add path writes a supplies column outside this module.
 *
 * (3) is the one that actually matters. The others can be satisfied by a careful
 * author; (3) catches a careless one.
 */

/** One non-blank value per fact, so nothing can be omitted by accident. */
const ALL_FACTS: Required<SupplyFacts> = {
  category: 'cgm_sensor',
  usageRatePerDay: 0.1,
  inUseDays: 28,
  catalogRefillIntervalDays: 90,
  discontinued: true,
  barcode: '00386270002839',
  pzn: '07242491',
  lotNumber: 'ABC123',
}

describe('supplyColumns', () => {
  it('maps every declared fact to a column', () => {
    const unmapped = Object.keys(ALL_FACTS).filter((k) => !(k in COLUMN_OF))
    expect(unmapped).toEqual([])
  })

  it('writes every column when every fact is known', () => {
    const written = Object.keys(supplyColumns(ALL_FACTS)).sort()
    expect(written).toEqual(Object.values(COLUMN_OF).sort())
  })

  it('omits a blank rather than writing null over something', () => {
    // The update runs after the insert, so writing null would erase a value the
    // row already had. Absence has to mean "leave it alone".
    expect(supplyColumns({})).toEqual({})
    expect(supplyColumns({ usageRatePerDay: 0, inUseDays: null, category: '' })).toEqual({})
    expect(supplyColumns({ barcode: '   ', pzn: '', lotNumber: undefined })).toEqual({})
  })

  it('treats the "unknown" placeholder as no category at all', () => {
    // 'unknown' is what the scan page carries for an unidentified product. It
    // is not a category, and storing it would make rescue detection think it
    // had a real answer.
    expect(supplyColumns({ category: 'unknown' })).toEqual({})
    expect(supplyColumns({ category: '  unknown  ' })).toEqual({})
  })

  it('writes discontinued only when true', () => {
    // The column defaults to false, so false is nothing to say.
    expect(supplyColumns({ discontinued: true })).toEqual({ discontinued: true })
    expect(supplyColumns({ discontinued: false })).toEqual({})
    expect(supplyColumns({ discontinued: null })).toEqual({})
  })

  it('refuses a nonsense number rather than storing it', () => {
    expect(supplyColumns({ usageRatePerDay: -1 })).toEqual({})
    expect(supplyColumns({ inUseDays: Number.NaN })).toEqual({})
    expect(supplyColumns({ catalogRefillIntervalDays: Number.POSITIVE_INFINITY })).toEqual({})
  })

  it('trims what it stores, so a stray space cannot break a later name match', () => {
    // supplies.name/barcode are joined against the catalog by exact equality in
    // supabase/setup.sql. A trailing space there is a row nothing can find.
    expect(supplyColumns({ barcode: ' 123 ', category: ' insulin ' }))
      .toEqual({ barcode: '123', category: 'insulin' })
  })
})

describe('both add paths go through supplyColumns', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const PATHS = ['src/app/scan/page.tsx', 'src/lib/addSupply.ts']

  it('each one imports it', () => {
    for (const p of PATHS) {
      expect(read(p), `${p} should build its payload with supplyColumns`).toMatch(/supplyColumns/)
    }
  })

  it('neither writes a supplies column by hand', () => {
    // The actual guard. Both files used to assemble an object key by key, which
    // is how one gained a column the other never got. Any payload-shaped
    // assignment of a snake_case column outside this module is that pattern
    // coming back.
    const COLUMNS = Object.values(COLUMN_OF)
    const offenders: string[] = []
    for (const p of PATHS) {
      for (const [i, line] of read(p).split(/\r?\n/).entries()) {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
        for (const col of COLUMNS) {
          // e.g. `idPayload.in_use_days =` or `patch['category'] =`
          if (new RegExp(`\\.${col}\\s*=[^=]`).test(line) || new RegExp(`\\['${col}'\\]\\s*=[^=]`).test(line)) {
            offenders.push(`${p}:${i + 1} writes ${col} directly`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
