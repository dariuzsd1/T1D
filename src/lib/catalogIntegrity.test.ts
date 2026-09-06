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

  /**
   * The rate checks below exist because "numeric" was the only bar a rate had to
   * clear, and two wrong ones walked straight through review looking perfectly
   * plausible:
   *
   *   - Omnipod GO carried 0.014, which is 1/72: its 72-HOUR wear had been
   *     entered as 72 days. The app then told anyone holding ten pods they had
   *     714 days of supply, and never warned them.
   *   - FreeStyle Libre 3 carried 0.067 (1/15), the wear time of the Libre 3
   *     PLUS, so a 14-day sensor was credited with a day it does not have.
   *
   * Neither is catchable by eye. Both are caught below.
   */

  /** Days one unit lasts, implied by the rate the catalog actually stores. */
  const impliedDaysPerUnit = (r: Row) => 1 / Number(r.typical_usage_per_day)
  const rated = rows.filter((r) => Number(r.typical_usage_per_day) > 0)

  it('has rated rows to check', () => {
    expect(rated.length).toBeGreaterThan(40)
  })

  it('keeps a rate consistent with the one its own notes claim', () => {
    // Most notes show their working ("10-day wear = 0.10/day"). Where they do,
    // the two must agree: a note edited without the column, or the reverse, is
    // how a reviewed row quietly stops meaning what it says.
    const drifted = rated.filter((r) => {
      const m = r.notes.match(/=\s*~?([\d.]+)\s*\/\s*day/i)
      return m ? Math.abs(Number(m[1]) - Number(r.typical_usage_per_day)) > 1e-9 : false
    })
    expect(named(drifted)).toEqual([])
  })

  it('keeps a rate consistent with the wear time its own notes state', () => {
    // Match the FIRST day figure in the notes: these are written wear-time
    // first, with comparisons ("the Plus is the 15-day sensor") afterwards. 3%
    // absorbs two-decimal rounding (0.143 reads as 6.99 days, not 7) and
    // nothing wider, since the Libre 3 error was 6.6% off and must not survive.
    const off = rated.filter((r) => {
      const m = r.notes.match(/(\d+)\s*-?\s*days?\b/i)
      if (!m) return false // no claim to check; the bounds test below covers it
      const claimed = Number(m[1])
      return Math.abs(impliedDaysPerUnit(r) - claimed) / claimed > 0.03
    })
    expect(named(off)).toEqual([])
  })

  it('keeps every rate inside the wear time its category can physically have', () => {
    // The backstop for a row whose notes claim nothing, which is exactly where
    // Omnipod GO hid. These bounds are clinical facts, not style: an infusion
    // set, pod, reservoir or cartridge is changed every 1-3 days, and the
    // longest-wearing one that exists (MiniMed Extended) is 7. A sensor runs
    // from the 7-day Guardian to the 365-day implanted Eversense.
    const BOUNDS: Record<string, [number, number]> = {
      infusion_set: [1, 7],
      patch_pump: [1, 7],
      cgm_sensor: [7, 365],
    }
    const impossible = rated.filter((r) => {
      const b = BOUNDS[r.category]
      if (!b) return false
      const days = impliedDaysPerUnit(r)
      // 2% either side, because a two-decimal rate lands just off a whole day:
      // the 7-day Guardian is stored as 0.143, which reads back as 6.99 days.
      return days < b[0] * 0.98 || days > b[1] * 1.02
    })
    expect(named(impossible)).toEqual([])
  })

  /**
   * in_use_days is how long an opened vial or pen stays usable. It reaches the
   * user as "discard in N days", so a wrong one either wastes insulin or, in the
   * direction that matters, tells someone that insulin past its discard date is
   * still fine to inject. Every insulin here carried a flat 28 until the labels
   * were read one at a time; the real spread is 10 to 56.
   */
  const windowed = rows.filter((r) => Number(r.in_use_days) > 0)

  it('keeps every discard window inside what an insulin label can say', () => {
    // 10 (Humalog Mix KwikPen) to 56 (Tresiba, Toujeo) covers every product in
    // this catalog. Anything outside it is a typo or a unit mix-up, which is
    // exactly how 0.014 got into a usage rate.
    const impossible = windowed.filter((r) => {
      const d = Number(r.in_use_days)
      return !Number.isInteger(d) || d < 10 || d > 56
    })
    expect(named(impossible)).toEqual([])
  })

  it('names a source for every discard window it states', () => {
    // A window is a claim about a drug label. Unsourced, nobody can tell later
    // whether it was read off the PI or assumed from the product next to it,
    // which is how one number ended up on all twenty-odd of them.
    expect(named(windowed.filter((r) => !r.source_url || !r.last_verified))).toEqual([])
  })

  it('keeps a discard window consistent with the one its own notes state', () => {
    // The bounds test cannot catch the failure that actually happened, because
    // a flat 28 is a legitimate window for most of these products and only wrong
    // on some. What separates them is the note: where a row states its window,
    // the column has to match, and putting 28 back on the Humalog Mix pen makes
    // its own note ("discarded 10 days after first use") contradict it.
    //
    // Match the FIRST day figure: these notes are written window-first, with the
    // other presentation ("the VIAL presentation is 28") after it.
    //
    // Conditional on purpose. Rows whose notes claim nothing are skipped rather
    // than failed: forcing a figure into every note would mean writing a claim
    // about a drug label nobody had read, which is the habit that produced the
    // flat 28 in the first place. Sourcing a row is what earns it a claim.
    const contradicted = windowed.filter((r) => {
      const m = r.notes.match(/(\d+)\s*-?\s*days?\b/i)
      return m ? Number(m[1]) !== Number(r.in_use_days) : false
    })
    expect(named(contradicted)).toEqual([])
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
