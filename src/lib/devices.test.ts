import { describe, it, expect } from 'vitest'
import { deviceLabel, type MedicalDevice } from './devices'

function device(over: Partial<MedicalDevice>): MedicalDevice {
  return {
    id: 'd', brand: 'Medtronic', model: 'MiniMed 780G', kind: 'pump',
    nickname: null, startedOn: null, notes: null,
    ...over,
  }
}

describe('deviceLabel — nickname-first display, brand/model fallback', () => {
  it('prefers the nickname when set', () => {
    expect(deviceLabel(device({ nickname: "Emma's pump" }))).toBe("Emma's pump")
  })

  it('ignores a nickname that is only whitespace', () => {
    expect(deviceLabel(device({ nickname: '   ' }))).toBe('Medtronic MiniMed 780G')
  })

  it('falls back to "brand model" with no nickname', () => {
    expect(deviceLabel(device({ brand: 'Dexcom', model: 'G7', nickname: null }))).toBe('Dexcom G7')
  })

  it('falls back to brand alone when model is missing', () => {
    expect(deviceLabel(device({ brand: 'Omnipod', model: null, nickname: null }))).toBe('Omnipod')
  })
})
