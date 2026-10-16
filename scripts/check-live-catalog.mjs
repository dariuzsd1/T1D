#!/usr/bin/env node
/**
 * Compare the LIVE `products` table against data/diabetes_catalog.csv.
 *
 * Why this exists: three bugs in the 2026-09 audit were invisible to the whole
 * test suite, because every test asserted things about functions and none
 * asserted anything about what was actually in the table. In each case the code
 * was correctly wired and inert for every real row:
 *
 *   - twelve discard-window corrections never applied, because each was guarded
 *     on `in_use_days = 28` and the column had never been populated at all;
 *   - the refill cycle reached only newly-added supplies, never existing ones;
 *   - every starter-kit supply name was pluralised, so nothing could join it
 *     back to its catalog row.
 *
 * All three showed up the moment someone ran a query. So run the query here,
 * from the repo, instead of asking.
 *
 * Reads only, and only `products`, which carries a `for select using (true)`
 * policy -- so the anon key already in .env.local is enough and no extra
 * credential is involved. Your own inventory (`supplies`) is RLS-scoped to the
 * signed-in user and is deliberately NOT readable here.
 *
 *   node scripts/check-live-catalog.mjs
 *
 * Exits non-zero when the live table disagrees with the reviewed CSV, so it can
 * be wired into CI later if that ever becomes useful.
 */
import { readFileSync } from 'node:fs'

const FIELDS = [
  'typical_usage_per_day',
  'in_use_days',
  'units_per_container',
  'default_refill_interval_days',
  'units_per_box',
]

function env() {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    out[line.slice(0, line.indexOf('=')).trim()] = line.slice(line.indexOf('=') + 1).trim()
  }
  return out
}

/** Minimal CSV reader, same quoting rules as the catalog actually uses. */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const header = rows[0]
  return rows.slice(1).filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(header.map((k, i) => [k, r[i] ?? ''])))
}

/** '' and null are the same claim: nothing recorded. */
const norm = (v) => (v === '' || v == null ? null : Number(v))
const same = (a, b) => {
  const x = norm(a), y = norm(b)
  if (x === null || y === null) return x === y
  return Math.abs(x - y) < 1e-9
}

// Bail-outs throw rather than call process.exit(): exiting while fetch still
// holds a handle trips a libuv assertion on Windows and loses the exit code.
function fatal(message) {
  console.error(message)
  process.exitCode = 2
  throw new Error(message)
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = env()
if (!url || !key) {
  fatal('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
}

const res = await fetch(
  `${url}/rest/v1/products?select=product_name,${FIELDS.join(',')}`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
)
if (!res.ok) {
  fatal(`Could not read products: HTTP ${res.status} ${await res.text()}`)
}

const live = new Map((await res.json()).map((r) => [r.product_name, r]))
const csv = parseCsv(readFileSync(new URL('../data/diabetes_catalog.csv', import.meta.url), 'utf8'))

const missing = []
const drifted = []
for (const row of csv) {
  const got = live.get(row.product_name)
  if (!got) { missing.push(row.product_name); continue }
  for (const f of FIELDS) {
    if (!same(row[f], got[f])) {
      drifted.push({ name: row.product_name, field: f, csv: row[f] || 'null', live: got[f] ?? 'null' })
    }
  }
}
const extra = [...live.keys()].filter((n) => !csv.some((r) => r.product_name === n))

console.log(`catalog: ${csv.length} rows in the CSV, ${live.size} in the live table`)

if (missing.length) {
  console.log(`\n${missing.length} row(s) in the CSV but NOT in the live table:`)
  for (const n of missing) console.log('  ' + n)
  console.log('  -> the catalog was never imported, or these are newer than the last import')
}
if (extra.length) {
  console.log(`\n${extra.length} row(s) live but not in the CSV (older import, or renamed):`)
  for (const n of extra) console.log('  ' + n)
}
if (drifted.length) {
  console.log(`\n${drifted.length} value(s) where the live table disagrees with the reviewed CSV:`)
  for (const d of drifted) {
    console.log(`  ${d.name.padEnd(36)} ${d.field.padEnd(30)} csv=${String(d.csv).padStart(8)}  live=${String(d.live).padStart(8)}`)
  }
  console.log('\n  -> run supabase/setup.sql, then re-run this. If a row still disagrees,')
  console.log('     the guard on its UPDATE did not match the value actually stored.')
}

if (!missing.length && !extra.length && !drifted.length) {
  console.log('\nLive table matches the reviewed CSV on every checked field.')
  process.exitCode = 0
} else {
  process.exitCode = 1
}
