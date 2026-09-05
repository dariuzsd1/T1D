import type { Product } from '@/lib/store'
import type { Prescription } from '@/lib/prescriptions'
import type { DisplayStatus } from '@/lib/depletion'
import type { TKey } from '@/lib/i18n/dictionaries'

/**
 * The decisions behind the refill list: which real-world path resupplies an item,
 * what to tell the user to do about it, and the plain-text version they copy,
 * share or print.
 *
 * These live outside the page because the exported text is what a pharmacist or
 * prescriber actually reads — it leaves the app and gets acted on — and because
 * the discontinued override is a safety rule, not formatting. Both are worth
 * pinning down in tests rather than trusting to a large component.
 */

/** Which real-world path resupplies this item, inferred from its linked Rx. */
export type RefillChannel = 'refill' | 'newRx' | 'noRx'

export interface RefillPlan {
  product: Product
  status: DisplayStatus
  rx: Prescription | null
  channel: RefillChannel
}

/** Channel groups, in the order they appear on screen and in the exported text. */
export const CHANNELS: { key: RefillChannel; head: TKey }[] = [
  { key: 'refill', head: 'reorder.groupRefill' },
  { key: 'newRx', head: 'reorder.groupNewRx' },
  { key: 'noRx', head: 'reorder.groupNoRx' },
]

/**
 * No prescription on file means we cannot say anything about refills. A linked
 * one with no refills left needs a new script, not a pharmacy trip. An unknown
 * refill count is treated as "refillable": telling someone to chase their
 * prescriber when they may simply be able to collect it is the worse error.
 */
export function refillChannelFor(rx: Prescription | null): RefillChannel {
  if (!rx) return 'noRx'
  if (rx.refillsRemaining != null && rx.refillsRemaining <= 0) return 'newRx'
  return 'refill'
}

/** Minimal translator shape, so this module needs no React context. */
type Translate = (key: TKey, vars?: Record<string, string | number>) => string

/**
 * The single action line for an item. A discontinued product overrides every
 * channel: there is nothing to refill and no new script to chase, so the only
 * honest instruction is to ask for a replacement.
 */
export function refillActionLabel(pl: RefillPlan, t: Translate): string {
  if (pl.product.discontinued) return t('reorder.actionDiscontinued')
  if (pl.channel === 'refill') {
    return pl.rx?.pharmacy
      ? t('reorder.actionRefillAt', { pharmacy: pl.rx.pharmacy })
      : t('reorder.actionRefillGeneric')
  }
  if (pl.channel === 'newRx') {
    return pl.rx?.prescriber
      ? t('reorder.actionNewRxFrom', { prescriber: pl.rx.prescriber })
      : t('reorder.actionNewRxGeneric')
  }
  return t('reorder.actionNoRx')
}

/** One line of the exported list. */
function refillTextLine(pl: RefillPlan, t: Translate): string {
  const name = pl.product.brand ? `${pl.product.name} (${pl.product.brand})` : pl.product.name
  // Lead with the stock word so a plain-text reader (or the pharmacy) still
  // learns which items are already out vs merely low — color can't carry it.
  const bits: string[] = [t(pl.status === 'out' ? 'reorder.stOut' : 'reorder.stLow')]
  // Flag it in the printed/shared list too: this is the copy a prescriber sees.
  if (pl.product.discontinued) bits.push(t('catalog.discontinued'))
  if (pl.rx?.rxNumber) bits.push(t('reorder.rxNumber', { rx: pl.rx.rxNumber }))
  if (pl.rx?.pharmacy) bits.push(pl.rx.pharmacy)
  if (pl.channel === 'refill' && pl.rx?.refillsRemaining != null) {
    bits.push(
      t(pl.rx.refillsRemaining === 1 ? 'reorder.refillsLeftOne' : 'reorder.refillsLeftOther', {
        count: pl.rx.refillsRemaining,
      }),
    )
  }
  if (pl.channel === 'newRx' && pl.rx?.prescriber) bits.push(pl.rx.prescriber)
  return `- ${name}: ${bits.join(', ')}`
}

/**
 * The copied / shared / printed list, grouped by channel so each section can be
 * handed to the right person. An empty channel is omitted rather than printed as
 * an empty heading.
 */
export function buildRefillText(plans: RefillPlan[], t: Translate, dateLabel: string): string {
  const section = (headingKey: TKey, c: RefillChannel): string[] => {
    const rows = plans.filter((pl) => pl.channel === c)
    if (rows.length === 0) return []
    return [`${t(headingKey)}:`, ...rows.map((pl) => refillTextLine(pl, t)), '']
  }
  return [
    t('reorder.textTitle'),
    dateLabel,
    '',
    ...CHANNELS.flatMap(({ key, head }) => section(head, key)),
  ]
    .join('\n')
    .trim()
}
