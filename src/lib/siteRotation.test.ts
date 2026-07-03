import { describe, it, expect } from 'vitest'
import {
  BODY_ZONES,
  RECENT_USE_DAYS,
  buildZoneViews,
  suggestedZoneId,
  hasZoneHistory,
  daysSince,
  elapsedText,
  type SiteChangeRow,
} from './siteRotation'

// Fixed "today" so elapsed math is deterministic.
const NOW = new Date(2026, 6, 2) // 2026-07-02 (local)

function ymd(daysAgo: number): string {
  const d = new Date(2026, 6, 2)
  d.setDate(d.getDate() - daysAgo)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function change(zone: string | null, daysAgo: number): SiteChangeRow {
  return { id: Math.random().toString(36).slice(2), body_zone: zone, applied_date: daysAgo < 0 ? null : ymd(daysAgo) }
}

describe('daysSince', () => {
  it('counts whole days and clamps future dates to 0', () => {
    expect(daysSince(ymd(3), NOW)).toBe(3)
    expect(daysSince(ymd(0), NOW)).toBe(0)
    expect(daysSince('2026-07-10', NOW)).toBe(0) // future → clamped
  })
  it('returns null for an unparseable date', () => {
    expect(daysSince('not-a-date', NOW)).toBeNull()
  })
})

describe('buildZoneViews', () => {
  it('marks never-logged zones honestly and covers all 9 zones', () => {
    const views = buildZoneViews([], NOW)
    expect(views.size).toBe(BODY_ZONES.length)
    for (const z of BODY_ZONES) expect(views.get(z.id)!.elapsed.kind).toBe('never')
  })

  it('uses the most recent change per zone and flags recent use', () => {
    const views = buildZoneViews(
      [change('abdomen_left', 20), change('abdomen_left', 3), change('thigh_left', 30)],
      NOW
    )
    const abd = views.get('abdomen_left')!
    expect(abd.elapsed).toMatchObject({ kind: 'days', days: 3 })
    expect(abd.isRecent).toBe(true) // 3 <= 14
    const thigh = views.get('thigh_left')!
    expect(thigh.elapsed).toMatchObject({ kind: 'days', days: 30 })
    expect(thigh.isRecent).toBe(false) // 30 > 14
  })

  it('treats the RECENT_USE_DAYS boundary as still recent', () => {
    const views = buildZoneViews([change('hip_left', RECENT_USE_DAYS)], NOW)
    expect(views.get('hip_left')!.isRecent).toBe(true)
  })

  it('reports unknown when a logged change has an unparseable date', () => {
    const views = buildZoneViews([{ id: 'x', body_zone: 'lower_back', applied_date: 'garbage' }], NOW)
    expect(views.get('lower_back')!.elapsed.kind).toBe('unknown')
  })
})

describe('suggestedZoneId', () => {
  it('prefers a never-used zone, taking the first by defined order', () => {
    // Everything used except two never-used zones → first never-used wins.
    const changes = BODY_ZONES.slice(2).map((z) => change(z.id, 5))
    const views = buildZoneViews(changes, NOW)
    // First two zones (abdomen_left, abdomen_right) are never-used.
    expect(suggestedZoneId(views)).toBe('abdomen_left')
  })

  it('picks the oldest last-used when every zone has history', () => {
    const changes = BODY_ZONES.map((z, i) => change(z.id, i + 1)) // increasing age by order
    const views = buildZoneViews(changes, NOW)
    // Oldest = last zone in the list.
    expect(suggestedZoneId(views)).toBe(BODY_ZONES[BODY_ZONES.length - 1].id)
  })
})

describe('hasZoneHistory', () => {
  it('is false with no rows and with only zone-less legacy rows', () => {
    expect(hasZoneHistory([])).toBe(false)
    expect(hasZoneHistory([change(null, 2)])).toBe(false)
    expect(hasZoneHistory([{ id: 'z', body_zone: 'not_a_real_zone', applied_date: ymd(1) }])).toBe(false)
  })
  it('is true once any real zone is logged', () => {
    expect(hasZoneHistory([change('thigh_right', 1)])).toBe(true)
  })
})

describe('elapsedText', () => {
  it('phrases each state', () => {
    expect(elapsedText({ kind: 'never' })).toBe('Not yet logged')
    expect(elapsedText({ kind: 'unknown' })).toBe('Last used: unknown')
    expect(elapsedText({ kind: 'days', days: 0, date: ymd(0) })).toBe('Last used today')
    expect(elapsedText({ kind: 'days', days: 1, date: ymd(1) })).toBe('Last used yesterday')
    expect(elapsedText({ kind: 'days', days: 5, date: ymd(5) })).toBe('Last used 5 days ago')
  })
})
