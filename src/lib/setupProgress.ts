/**
 * "Finish setup" progress — the home-page onboarding nudge (CLAUDE.md §8: turn a
 * barren new account into visible progress, and collect the data the hero/timeline
 * need to light up).
 *
 * Honesty rule (CLAUDE.md §1/§9): each step's `done` reflects REAL stored data, not
 * an assumption. A step counts as complete only when we can actually see the value.
 *
 * Scope note: two of the originally-imagined steps have no real intake in the app
 * yet — an account-level pharmacy / DME supplier, and a named insurance plan. They
 * are deliberately NOT included here (a step you can't complete would be a lie).
 * The refill-cadence half of "insurance + refill" IS real, so it stays.
 */

import type { Product } from './store'

export interface SetupStep {
  key: string
  /** Plain, supportive label. */
  label: string
  /** Backed by real stored data — never assumed. */
  done: boolean
  /** Where tapping the step takes the user to complete it. */
  href: string
}

export interface SetupInputs {
  inventory: Product[]
  /** Number of medical_devices rows (a selected pump/CGM ecosystem). */
  deviceCount: number
}

/** The real, verifiable onboarding steps in natural order. */
export function setupSteps({ inventory, deviceCount }: SetupInputs): SetupStep[] {
  const hasSupply = inventory.length > 0
  const hasDevice = deviceCount > 0
  const hasUsage = inventory.some((p) => (p.usageRatePerDay ?? 0) > 0)
  const hasRefill = inventory.some((p) => (p.refillIntervalDays ?? 0) > 0)

  // supply + device are what the onboarding flow collects, so those steps route
  // into it; usage + refill are per-supply, edited on the Supplies page.
  return [
    { key: 'supply', label: 'Add your first supply', done: hasSupply, href: '/dashboard/onboarding' },
    { key: 'device', label: 'Add your pump or CGM', done: hasDevice, href: '/dashboard/onboarding' },
    { key: 'usage', label: 'Set how fast you use a supply', done: hasUsage, href: '/dashboard/supplies' },
    { key: 'refill', label: 'Add a refill cycle', done: hasRefill, href: '/dashboard/supplies' },
  ]
}

export function setupDoneCount(steps: SetupStep[]): number {
  return steps.filter((s) => s.done).length
}

/** True once every real step is satisfied — the nudge then disappears for good. */
export function setupComplete(steps: SetupStep[]): boolean {
  return steps.length > 0 && steps.every((s) => s.done)
}
