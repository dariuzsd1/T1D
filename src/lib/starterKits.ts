/**
 * Starter kits — the fastest way to set up: pick your insulin-delivery system and
 * your CGM, and the app adds the standard consumables for each, with real box
 * counts and wear rates already filled in. This sidesteps both typing and the
 * barcode-coverage gap for first-time setup.
 *
 * Every number here is a verified product fact mirrored from the reviewed catalog
 * (data/diabetes_catalog.csv): units per box and the per-unit wear rate
 * (1 / days-each-lasts). Per-person-consumption items (pen needles) carry rate 0,
 * so their runway stays an honest estimate until the user sets it — never faked.
 */

export interface KitSupply {
  name: string
  brand: string
  category: string
  unitsPerBox: number
  /** units/day. 0 = per-person → runway shown as an estimate, not a known fact. */
  usageRatePerDay: number
  /** The catalog's typical dispensing cycle. Carried so onboarding produces a
   *  refill-eligible date the way the scan path does; it never did before. */
  refillIntervalDays: number
  /** True when the maker has stopped producing it. The G6 kit and both
   *  pre-Plus Libre kits build from discontinued sensors, and without this the
   *  reorder list offered to reorder a product nobody sells. */
  discontinued?: boolean
}

export interface KitOption {
  id: string
  label: string
  sublabel?: string
  /** The device this option represents, so onboarding can register it in
   *  `medical_devices` (brand/model align with DEVICE_PRESETS in devices.ts).
   *  Omitted for options that aren't a device, e.g. MDI pens. */
  device?: { brand: string; model: string; kind: 'pump' | 'cgm' }
  supplies: KitSupply[]
}

const POD_3DAY = 0.33 // a pod/set/cartridge changed every ~3 days
const SENSOR_10DAY = 0.1 // Dexcom G6/G7 (10-day wear)
// 1/14. Libre 2 and Libre 3 are BOTH 14-day sensors; only the "Plus" revisions
// run 15 days. This constant previously held 0.067 (1/15) under this same
// SENSOR_14DAY name, which credited Libre 3 with the Plus wear time and read a
// day long per sensor. Name and value now agree.
const SENSOR_14DAY = 0.071
const SENSOR_7DAY = 0.143 // Medtronic Guardian (7-day wear)

export const DELIVERY_OPTIONS: KitOption[] = [
  {
    id: 'omnipod5',
    label: 'Omnipod 5',
    sublabel: 'Insulet',
    device: { brand: 'Omnipod', model: 'Omnipod 5', kind: 'pump' },
    supplies: [
      { name: 'Omnipod 5 Pod', brand: 'Insulet', category: 'patch_pump', unitsPerBox: 5, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'omnipod_dash',
    label: 'Omnipod DASH',
    sublabel: 'Insulet',
    device: { brand: 'Omnipod', model: 'Omnipod DASH', kind: 'pump' },
    supplies: [
      { name: 'Omnipod DASH Pod', brand: 'Insulet', category: 'patch_pump', unitsPerBox: 5, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'tslim_x2',
    label: 't:slim X2',
    sublabel: 'Tandem',
    device: { brand: 'Tandem', model: 't:slim X2', kind: 'pump' },
    supplies: [
      { name: 't:slim X2 Cartridge', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
      { name: 'AutoSoft 90 Infusion Set', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'tandem_mobi',
    label: 'Tandem Mobi',
    sublabel: 'Tandem',
    device: { brand: 'Tandem', model: 'Mobi', kind: 'pump' },
    supplies: [
      { name: 'Tandem Mobi Cartridge', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
      { name: 'AutoSoft 90 Infusion Set', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'minimed',
    label: 'MiniMed (770G / 780G)',
    sublabel: 'Medtronic',
    device: { brand: 'Medtronic', model: 'MiniMed 780G', kind: 'pump' },
    supplies: [
      { name: 'MiniMed Reservoir', brand: 'MiniMed', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
      { name: 'Mio Advance Infusion Set', brand: 'MiniMed', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'ilet',
    label: 'iLet Bionic Pancreas',
    sublabel: 'Beta Bionics',
    device: { brand: 'Beta Bionics', model: 'iLet', kind: 'pump' },
    supplies: [
      { name: 'iLet Cartridge', brand: 'Beta Bionics', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
      { name: 'iLet Infusion Set', brand: 'Beta Bionics', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'ypsopump',
    label: 'mylife YpsoPump',
    sublabel: 'Ypsomed',
    device: { brand: 'Ypsomed', model: 'YpsoPump', kind: 'pump' },
    supplies: [
      { name: 'mylife YpsoPump Reservoir', brand: 'Ypsomed', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
      { name: 'mylife YpsoPump Orbit Infusion Set', brand: 'Ypsomed', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'mdi',
    label: 'Insulin pens (MDI)',
    sublabel: 'No pump',
    supplies: [
      { name: 'BD Ultra-Fine Pen Needles', brand: 'BD', category: 'mdi_supply', unitsPerBox: 90, usageRatePerDay: 0, refillIntervalDays: 90 },
    ],
  },
]

export const CGM_OPTIONS: KitOption[] = [
  {
    id: 'dexcom_g7',
    label: 'Dexcom G7',
    sublabel: 'Dexcom',
    device: { brand: 'Dexcom', model: 'G7', kind: 'cgm' },
    supplies: [
      { name: 'Dexcom G7 Sensor', brand: 'Dexcom', category: 'cgm_sensor', unitsPerBox: 3, usageRatePerDay: SENSOR_10DAY, refillIntervalDays: 90 },
    ],
  },
  {
    id: 'dexcom_g6',
    label: 'Dexcom G6',
    sublabel: 'Dexcom',
    device: { brand: 'Dexcom', model: 'G6', kind: 'cgm' },
    supplies: [
      { name: 'Dexcom G6 Sensor', brand: 'Dexcom', category: 'cgm_sensor', unitsPerBox: 3, usageRatePerDay: SENSOR_10DAY, refillIntervalDays: 90, discontinued: true },
    ],
  },
  {
    id: 'libre3',
    label: 'FreeStyle Libre 3',
    sublabel: 'Abbott',
    device: { brand: 'Abbott', model: 'FreeStyle Libre 3', kind: 'cgm' },
    supplies: [
      { name: 'FreeStyle Libre 3 Sensor', brand: 'Abbott', category: 'cgm_sensor', unitsPerBox: 1, usageRatePerDay: SENSOR_14DAY, refillIntervalDays: 90, discontinued: true },
    ],
  },
  {
    id: 'libre2',
    label: 'FreeStyle Libre 2',
    sublabel: 'Abbott',
    device: { brand: 'Abbott', model: 'FreeStyle Libre 2', kind: 'cgm' },
    supplies: [
      { name: 'FreeStyle Libre 2 Sensor', brand: 'Abbott', category: 'cgm_sensor', unitsPerBox: 1, usageRatePerDay: SENSOR_14DAY, refillIntervalDays: 90, discontinued: true },
    ],
  },
  {
    id: 'guardian4',
    label: 'Guardian 4',
    sublabel: 'Medtronic',
    device: { brand: 'Medtronic', model: 'Guardian 4', kind: 'cgm' },
    supplies: [
      { name: 'Guardian 4 Sensor', brand: 'MiniMed', category: 'cgm_sensor', unitsPerBox: 5, usageRatePerDay: SENSOR_7DAY, refillIntervalDays: 90 },
    ],
  },
]

/** Merge the chosen options into the flat list of supplies to create. */
export function kitSupplies(deliveryId: string | null, cgmId: string | null): KitSupply[] {
  const delivery = DELIVERY_OPTIONS.find(o => o.id === deliveryId)
  const cgm = CGM_OPTIONS.find(o => o.id === cgmId)
  return [...(delivery?.supplies ?? []), ...(cgm?.supplies ?? [])]
}

/** The devices to register for the chosen options (skips non-device picks, e.g. MDI). */
export function kitDevices(
  deliveryId: string | null,
  cgmId: string | null,
): { brand: string; model: string; kind: 'pump' | 'cgm' }[] {
  const delivery = DELIVERY_OPTIONS.find(o => o.id === deliveryId)
  const cgm = CGM_OPTIONS.find(o => o.id === cgmId)
  return [delivery?.device, cgm?.device].filter(
    (d): d is { brand: string; model: string; kind: 'pump' | 'cgm' } => Boolean(d),
  )
}

/**
 * A kit entry in the shape `addSupply.createSupplies` wants.
 *
 * One mapping, because there are two callers (first-run onboarding and the
 * Quick Start modal) and each used to spell it out by hand. That is the same
 * duplication that cost six columns elsewhere: both dropped every field added
 * to KitSupply after they were written, silently, because a missing optional
 * column just reads NULL.
 *
 * inUseDays and expirationDate are deliberately absent: no kit contains insulin,
 * and nothing here has a box in hand to read an expiry off.
 */
export function kitSupplyToNewSupply(s: KitSupply) {
  return {
    name: s.name,
    brand: s.brand,
    category: s.category,
    quantity: s.unitsPerBox,
    usageRatePerDay: s.usageRatePerDay,
    refillIntervalDays: s.refillIntervalDays,
    discontinued: s.discontinued,
  }
}
