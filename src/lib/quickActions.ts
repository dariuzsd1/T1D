import type { Product } from './store'
import type { TKey } from './i18n/dictionaries'

/**
 * Quick "log use" actions for the floating + hub, derived from what the user
 * actually stocks — brand-agnostic, so it works for Omnipod, Medtronic, Tandem,
 * Dexcom, Libre, Guardian, etc. (replaces the old hardcoded Insulet/Dexcom
 * brand strings). Pure so it can be unit-tested and reused.
 */

export type QuickDepleteKind = 'pod' | 'site' | 'sensor'

export interface QuickDepleteAction {
  kind: QuickDepleteKind
  /** The specific inventory item this action decrements. */
  productId: string
  productName: string
  labelKey: TKey
  subKey: TKey
}

// Match on the human-readable name (and category as a weak hint). Word-boundary
// aware so a pump named "Omnipod" doesn't get mistaken for a "pod" supply, while
// the "Pods" supply itself still matches.
const POD_RE = /\bpods?\b/i
const SITE_RE = /infusion\s*set|reservoir|cartridge|\binfusion\b/i
const SENSOR_RE = /\bsensors?\b|\blibre\b|\bguardian\b|\bcgm\b/i

/**
 * At most one pump-site consumable (a pod, or an infusion set / reservoir) and
 * one CGM sensor. Prefers an item that still has stock so the tap actually
 * decrements something; falls back to the first match so the action still shows
 * (tapping it then surfaces the honest "you're out" message).
 */
export function deriveDepletionActions(inventory: Product[]): QuickDepleteAction[] {
  const pick = (re: RegExp): Product | undefined => {
    const matches = inventory.filter((p) => re.test(`${p.name} ${p.category}`))
    return matches.find((p) => p.quantity > 0) ?? matches[0]
  }

  const actions: QuickDepleteAction[] = []

  // Pods and tubed-pump sites are both "the pump site" — offer only one.
  const pod = pick(POD_RE)
  if (pod) {
    actions.push({
      kind: 'pod',
      productId: pod.id,
      productName: pod.name,
      labelKey: 'quickActions.podChange',
      subKey: 'quickActions.podChangeSub',
    })
  } else {
    const site = pick(SITE_RE)
    if (site) {
      actions.push({
        kind: 'site',
        productId: site.id,
        productName: site.name,
        labelKey: 'quickActions.siteChange',
        subKey: 'quickActions.siteChangeSub',
      })
    }
  }

  const sensor = pick(SENSOR_RE)
  if (sensor) {
    actions.push({
      kind: 'sensor',
      productId: sensor.id,
      productName: sensor.name,
      labelKey: 'quickActions.logSensor',
      subKey: 'quickActions.logSensorSub',
    })
  }

  return actions
}
