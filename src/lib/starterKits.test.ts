import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DELIVERY_OPTIONS, CGM_OPTIONS, kitSupplies, type KitSupply } from './starterKits'

/**
 * The starter kits must name products the way the catalog names them.
 *
 * They did not, and every single one was wrong. Names were pluralised
 * ("Dexcom G7 Sensors" against a catalog row of "Dexcom G7 Sensor"), three were
 * different products entirely ("YpsoPump Cartridges" for what Ypsomed prints as
 * "mylife YpsoPump Reservoir"), and three brands still said Medtronic after the
 * 2026-03 MiniMed rebrand. Nothing failed loudly, because nothing joins these
 * at write time -- the kit just inserts the string it was given.
 *
 * What it cost, all of it invisible until a real database was queried:
 *
 *   - `supplies.name` is how everything later finds a supply's catalog row, so
 *     every item onboarding created was permanently orphaned. A catalog-joined
 *     backfill skipped them (that is how this was found: a user's refill cycle
 *     was null for exactly the kit-added rows and set for the scanned ones).
 *   - ProductCard's one-tap restock resolves `units_per_box` by name and falls
 *     back to 1 on a miss, so Reorder on a kit-added sensor added one sensor
 *     instead of three. The `common_names` aliases do not rescue it: none of
 *     them carry a plural.
 *
 * Onboarding is the primary intake path, so this was the default experience.
 */

interface Row { [k: string]: string }

const csv = readFileSync(join(process.cwd(), 'data/diabetes_catalog.csv'), 'utf8')

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

const catalog = parse(csv)
const byName = new Map(catalog.map((r) => [r.product_name, r]))

/** Every supply any kit can create, deduplicated. */
const allKitSupplies: KitSupply[] = [
  ...DELIVERY_OPTIONS.flatMap((o) => o.supplies),
  ...CGM_OPTIONS.flatMap((o) => o.supplies),
].filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i)

describe('starter kits line up with the catalog', () => {
  it('has kits to check', () => {
    expect(allKitSupplies.length).toBeGreaterThan(10)
  })

  it('names every supply exactly as the catalog names it', () => {
    // Exact, not normalised. A supply whose name differs by a trailing "s" is a
    // supply nothing can ever join back to its product.
    const orphaned = allKitSupplies.filter((s) => !byName.has(s.name))
    expect(orphaned.map((s) => s.name)).toEqual([])
  })

  it('uses the brand the catalog uses', () => {
    // Not cosmetic: findByNameAndBrand in duplicateSupply.ts matches on both, so
    // a stale brand means re-scanning a box you own offers to add a second row
    // instead of restocking the one you have.
    const wrong = allKitSupplies.filter((s) => {
      const row = byName.get(s.name)
      return row ? row.brand !== s.brand : false
    })
    expect(wrong.map((s) => `${s.name}: kit "${s.brand}" vs catalog "${byName.get(s.name)!.brand}"`)).toEqual([])
  })

  it('agrees with the catalog on box size and wear rate', () => {
    // The kit writes both onto the supply, so a disagreement means onboarding
    // hands someone a different quantity or runway than scanning the same box.
    const wrong = allKitSupplies.filter((s) => {
      const row = byName.get(s.name)
      if (!row) return false
      const boxOff = Number(row.units_per_box) !== s.unitsPerBox
      const rateOff = s.usageRatePerDay > 0
        && Math.abs(Number(row.typical_usage_per_day) - s.usageRatePerDay) > 1e-9
      return boxOff || rateOff
    })
    expect(wrong.map((s) => s.name)).toEqual([])
  })

  it('puts a real category on everything, so rescue detection works', () => {
    const bad = allKitSupplies.filter((s) => {
      const row = byName.get(s.name)
      return row ? row.category !== s.category : false
    })
    expect(bad.map((s) => s.name)).toEqual([])
  })

  it('still assembles a kit for every option', () => {
    for (const d of DELIVERY_OPTIONS) {
      for (const c of CGM_OPTIONS) {
        expect(kitSupplies(d.id, c.id).length).toBeGreaterThan(0)
      }
    }
  })
})
