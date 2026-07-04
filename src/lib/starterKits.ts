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
const SENSOR_14DAY = 0.067 // FreeStyle Libre 3 (~15-day wear)
const SENSOR_LIBRE2 = 0.071 // FreeStyle Libre 2 (14-day wear)
const SENSOR_7DAY = 0.143 // Medtronic Guardian (7-day wear)

export const DELIVERY_OPTIONS: KitOption[] = [
  {
    id: 'omnipod5',
    label: 'Omnipod 5',
    sublabel: 'Insulet',
    device: { brand: 'Omnipod', model: 'Omnipod 5', kind: 'pump' },
    supplies: [
      { name: 'Omnipod 5 Pods', brand: 'Insulet', category: 'patch_pump', unitsPerBox: 5, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'omnipod_dash',
    label: 'Omnipod DASH',
    sublabel: 'Insulet',
    device: { brand: 'Omnipod', model: 'Omnipod DASH', kind: 'pump' },
    supplies: [
      { name: 'Omnipod DASH Pods', brand: 'Insulet', category: 'patch_pump', unitsPerBox: 5, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'tslim_x2',
    label: 't:slim X2',
    sublabel: 'Tandem',
    device: { brand: 'Tandem', model: 't:slim X2', kind: 'pump' },
    supplies: [
      { name: 't:slim X2 Cartridges', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
      { name: 'AutoSoft 90 Infusion Sets', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'tandem_mobi',
    label: 'Tandem Mobi',
    sublabel: 'Tandem',
    device: { brand: 'Tandem', model: 'Mobi', kind: 'pump' },
    supplies: [
      { name: 'Tandem Mobi Cartridges', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
      { name: 'AutoSoft 90 Infusion Sets', brand: 'Tandem', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'minimed',
    label: 'MiniMed (770G / 780G)',
    sublabel: 'Medtronic',
    device: { brand: 'Medtronic', model: 'MiniMed 780G', kind: 'pump' },
    supplies: [
      { name: 'MiniMed Reservoirs', brand: 'Medtronic', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
      { name: 'Mio Advance Infusion Sets', brand: 'Medtronic', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'ilet',
    label: 'iLet Bionic Pancreas',
    sublabel: 'Beta Bionics',
    device: { brand: 'Beta Bionics', model: 'iLet', kind: 'pump' },
    supplies: [
      { name: 'iLet Cartridges', brand: 'Beta Bionics', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
      { name: 'iLet Infusion Sets', brand: 'Beta Bionics', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'ypsopump',
    label: 'mylife YpsoPump',
    sublabel: 'Ypsomed',
    device: { brand: 'Ypsomed', model: 'YpsoPump', kind: 'pump' },
    supplies: [
      { name: 'YpsoPump Cartridges', brand: 'Ypsomed', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
      { name: 'mylife Orbit Infusion Sets', brand: 'Ypsomed', category: 'infusion_set', unitsPerBox: 10, usageRatePerDay: POD_3DAY },
    ],
  },
  {
    id: 'mdi',
    label: 'Insulin pens (MDI)',
    sublabel: 'No pump',
    supplies: [
      { name: 'Pen Needles', brand: 'BD', category: 'mdi_supply', unitsPerBox: 90, usageRatePerDay: 0 },
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
      { name: 'Dexcom G7 Sensors', brand: 'Dexcom', category: 'cgm_sensor', unitsPerBox: 3, usageRatePerDay: SENSOR_10DAY },
    ],
  },
  {
    id: 'dexcom_g6',
    label: 'Dexcom G6',
    sublabel: 'Dexcom',
    device: { brand: 'Dexcom', model: 'G6', kind: 'cgm' },
    supplies: [
      { name: 'Dexcom G6 Sensors', brand: 'Dexcom', category: 'cgm_sensor', unitsPerBox: 3, usageRatePerDay: SENSOR_10DAY },
    ],
  },
  {
    id: 'libre3',
    label: 'FreeStyle Libre 3',
    sublabel: 'Abbott',
    device: { brand: 'Abbott', model: 'FreeStyle Libre 3', kind: 'cgm' },
    supplies: [
      { name: 'FreeStyle Libre 3 Sensors', brand: 'Abbott', category: 'cgm_sensor', unitsPerBox: 1, usageRatePerDay: SENSOR_14DAY },
    ],
  },
  {
    id: 'libre2',
    label: 'FreeStyle Libre 2',
    sublabel: 'Abbott',
    device: { brand: 'Abbott', model: 'FreeStyle Libre 2', kind: 'cgm' },
    supplies: [
      { name: 'FreeStyle Libre 2 Sensors', brand: 'Abbott', category: 'cgm_sensor', unitsPerBox: 1, usageRatePerDay: SENSOR_LIBRE2 },
    ],
  },
  {
    id: 'guardian4',
    label: 'Guardian 4',
    sublabel: 'Medtronic',
    device: { brand: 'Medtronic', model: 'Guardian 4', kind: 'cgm' },
    supplies: [
      { name: 'Guardian 4 Sensors', brand: 'Medtronic', category: 'cgm_sensor', unitsPerBox: 5, usageRatePerDay: SENSOR_7DAY },
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
