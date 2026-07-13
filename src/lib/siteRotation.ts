/**
 * Body-zone model + rotation logic for the site-rotation map
 * (src/app/dashboard/site-tracker/page.tsx).
 *
 * Honesty rules (CLAUDE.md §9.1, §7 V2): every per-zone status is derived from
 * real `site_changes` rows. A zone with no logged change reads "Not yet logged";
 * an unparseable date reads "unknown". Nothing here fabricates a date or a verdict.
 *
 * Left/right convention (confirmed in Stage 1 review): the figure is read as a
 * person, so on the FRONT view (facing you) the person's left is on your right;
 * on the BACK view (facing away) the person's left is on your left. That mirror
 * is baked into each zone's geometry `x` below — the labels are anatomical.
 */

import type { TKey } from './i18n/dictionaries'

export type BodyView = 'front' | 'back'

/** Any zone used within this many days counts as "recently used" (amber). Kept a
 *  single constant so it can later be made device-type-aware; not per-device now. */
export const RECENT_USE_DAYS = 14

export interface BodyZone {
  /** Stable id — persisted as `site_changes.body_zone`. */
  id: string
  region: string
  side: 'left' | 'right' | 'center'
  view: BodyView
  // Rounded-rect geometry in the 260×520 SVG viewBox (the naturalistic figure).
  x: number
  y: number
  w: number
  h: number
  rx: number
}

// Order matters: ties for "suggested next" resolve to the first zone here.
// Geometry is positioned on the redesigned silhouette (260×520 viewBox); the
// figure's own paths live in site-tracker/page.tsx. Center line is x=130.
export const BODY_ZONES: BodyZone[] = [
  // FRONT — mirrored (person faces you): person's left drawn on screen-right.
  { id: 'abdomen_left', region: 'Abdomen', side: 'left', view: 'front', x: 136, y: 168, w: 28, h: 42, rx: 12 },
  { id: 'abdomen_right', region: 'Abdomen', side: 'right', view: 'front', x: 96, y: 168, w: 28, h: 42, rx: 12 },
  { id: 'thigh_left', region: 'Thigh', side: 'left', view: 'front', x: 143, y: 288, w: 27, h: 60, rx: 12 },
  { id: 'thigh_right', region: 'Thigh', side: 'right', view: 'front', x: 90, y: 288, w: 27, h: 60, rx: 12 },
  // BACK — direct (person faces away): person's left drawn on screen-left.
  { id: 'upper_arm_left', region: 'Upper arm', side: 'left', view: 'back', x: 58, y: 150, w: 20, h: 58, rx: 9 },
  { id: 'upper_arm_right', region: 'Upper arm', side: 'right', view: 'back', x: 182, y: 150, w: 20, h: 58, rx: 9 },
  { id: 'lower_back', region: 'Lower back', side: 'center', view: 'back', x: 100, y: 196, w: 60, h: 38, rx: 13 },
  { id: 'hip_left', region: 'Hip / upper buttock', side: 'left', view: 'back', x: 92, y: 242, w: 32, h: 48, rx: 15 },
  { id: 'hip_right', region: 'Hip / upper buttock', side: 'right', view: 'back', x: 136, y: 242, w: 32, h: 48, rx: 15 },
  // Upper arms are also reachable from the FRONT (the outer/front upper arm),
  // distinct from the back-of-arm zones above.
  { id: 'arm_front_left', region: 'Upper arm', side: 'left', view: 'front', x: 182, y: 150, w: 20, h: 58, rx: 9 },
  { id: 'arm_front_right', region: 'Upper arm', side: 'right', view: 'front', x: 58, y: 150, w: 20, h: 58, rx: 9 },
  // Top of the shoulder (deltoid cap) — out on the shoulders, not the upper back.
  { id: 'shoulder_left', region: 'Shoulder', side: 'left', view: 'back', x: 60, y: 120, w: 30, h: 26, rx: 13 },
  { id: 'shoulder_right', region: 'Shoulder', side: 'right', view: 'back', x: 170, y: 120, w: 30, h: 26, rx: 13 },
]

export const BODY_ZONE_IDS: readonly string[] = BODY_ZONES.map((z) => z.id)

// Precomposed per-zone keys (not built from side+region at runtime) because
// word order differs by language (English puts the side first, French puts it
// after the noun) — each language's dictionary just writes the correct phrase.
const ZONE_LABEL_KEY: Record<string, TKey> = {
  abdomen_left: 'zone.abdomenLeft',
  abdomen_right: 'zone.abdomenRight',
  thigh_left: 'zone.thighLeft',
  thigh_right: 'zone.thighRight',
  upper_arm_left: 'zone.upperArmLeft',
  upper_arm_right: 'zone.upperArmRight',
  lower_back: 'zone.lowerBack',
  hip_left: 'zone.hipLeft',
  hip_right: 'zone.hipRight',
  // Front upper arms reuse the arm labels (view context disambiguates them).
  arm_front_left: 'zone.upperArmLeft',
  arm_front_right: 'zone.upperArmRight',
  shoulder_left: 'zone.shoulderLeft',
  shoulder_right: 'zone.shoulderRight',
}

const ZONE_ARIA_KEY: Record<string, TKey> = {
  abdomen_left: 'zone.abdomenLeftAria',
  abdomen_right: 'zone.abdomenRightAria',
  thigh_left: 'zone.thighLeftAria',
  thigh_right: 'zone.thighRightAria',
  upper_arm_left: 'zone.upperArmLeftAria',
  upper_arm_right: 'zone.upperArmRightAria',
  lower_back: 'zone.lowerBack', // center zone: label and aria are the same phrase
  hip_left: 'zone.hipLeftAria',
  hip_right: 'zone.hipRightAria',
  arm_front_left: 'zone.upperArmLeftAria',
  arm_front_right: 'zone.upperArmRightAria',
  shoulder_left: 'zone.shoulderLeftAria',
  shoulder_right: 'zone.shoulderRightAria',
}

/** Translation key for the short display label, e.g. "Left abdomen". Render with t(). */
export function zoneLabelKey(z: BodyZone): TKey {
  return ZONE_LABEL_KEY[z.id]
}

/** Translation key for the aria fragment, e.g. "Abdomen, left side". Render with t(). */
export function zoneAriaKey(z: BodyZone): TKey {
  return ZONE_ARIA_KEY[z.id]
}

export function zoneCenter(z: BodyZone): { cx: number; cy: number } {
  return { cx: z.x + z.w / 2, cy: z.y + z.h / 2 }
}

/** Only the fields the marker logic needs from a site_changes row. */
export interface SiteChangeRow {
  id: string
  body_zone: string | null
  applied_date: string | null
}

/** Real elapsed time since a zone's most recent logged change. */
export type Elapsed =
  | { kind: 'never' }
  | { kind: 'unknown' }
  | { kind: 'days'; days: number; date: string }

export interface ZoneView {
  zone: BodyZone
  elapsed: Elapsed
  /** Used within RECENT_USE_DAYS. Only true for a real, dated change. */
  isRecent: boolean
}

function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole days between a YYYY-MM-DD date and today (local, clamped at 0). null if
 *  the string can't be parsed. */
export function daysSince(dateStr: string, now: Date = new Date()): number | null {
  const d = parseYmd(dateStr)
  if (!d) return null
  return Math.max(0, Math.round((midnight(now) - midnight(d)) / 86_400_000))
}

/** Does the user have ANY zone-attributed history? (false = true first-time or
 *  pre-migration state → the map shows a first-log prompt, not a suggestion.) */
export function hasZoneHistory(changes: SiteChangeRow[]): boolean {
  return changes.some((c) => c.body_zone != null && BODY_ZONE_IDS.includes(c.body_zone))
}

/** Build the per-zone view (most recent real change → elapsed + recent flag). */
export function buildZoneViews(
  changes: SiteChangeRow[],
  now: Date = new Date()
): Map<string, ZoneView> {
  // Newest real dated change per zone.
  const latest = new Map<string, string>()
  for (const c of changes) {
    if (!c.body_zone || !c.applied_date) continue
    const prev = latest.get(c.body_zone)
    if (!prev || c.applied_date > prev) latest.set(c.body_zone, c.applied_date)
  }

  const views = new Map<string, ZoneView>()
  for (const zone of BODY_ZONES) {
    const date = latest.get(zone.id)
    let elapsed: Elapsed
    if (!date) {
      elapsed = { kind: 'never' }
    } else {
      const days = daysSince(date, now)
      elapsed = days == null ? { kind: 'unknown' } : { kind: 'days', days, date }
    }
    const isRecent = elapsed.kind === 'days' && elapsed.days <= RECENT_USE_DAYS
    views.set(zone.id, { zone, elapsed, isRecent })
  }
  return views
}

/**
 * The single best "suggested next" zone: the longest-rested spot, with never-used
 * zones ranked highest (oldest possible). Ties resolve to the first by BODY_ZONES
 * order. Returns exactly one id (or null if there are no zones). Callers only
 * surface it when hasZoneHistory() is true.
 */
export function suggestedZoneId(views: Map<string, ZoneView>): string | null {
  let bestId: string | null = null
  let bestScore = -Infinity
  for (const zone of BODY_ZONES) {
    const v = views.get(zone.id)
    if (!v) continue
    // never = oldest possible; days = older is higher; unknown = lowest priority.
    const score =
      v.elapsed.kind === 'never' ? Infinity : v.elapsed.kind === 'days' ? v.elapsed.days : -Infinity
    // Strictly-greater keeps the FIRST zone on a tie (correct tie-break).
    if (score > bestScore) {
      bestScore = score
      bestId = zone.id
    }
  }
  return bestId
}

/**
 * Translation key (+ vars) for the human elapsed text, e.g. "Last used 3 days
 * ago" / "Not yet logged". Render with `t(key, vars)`.
 */
export function elapsedTextKey(elapsed: Elapsed): { key: TKey; vars?: { days: number } } {
  switch (elapsed.kind) {
    case 'never':
      return { key: 'zone.notYetLogged' }
    case 'unknown':
      return { key: 'zone.lastUsedUnknown' }
    case 'days':
      if (elapsed.days === 0) return { key: 'zone.lastUsedToday' }
      if (elapsed.days === 1) return { key: 'zone.lastUsedYesterday' }
      return { key: 'zone.lastUsedDaysAgo', vars: { days: elapsed.days } }
  }
}
