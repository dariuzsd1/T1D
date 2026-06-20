import { describe, it, expect } from 'vitest'
import { buildExportDocument, exportFilename, EXPORT_SOURCES } from './dataExport'

describe('exportFilename', () => {
  it('formats a dated JSON filename', () => {
    expect(exportFilename(new Date('2026-06-20T15:00:00Z'))).toBe('t1d-hub-export-2026-06-20.json')
  })

  it('always ends in .json', () => {
    expect(exportFilename(new Date('2024-01-02T00:00:00Z'))).toMatch(/^t1d-hub-export-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('buildExportDocument', () => {
  const account = { id: 'u-1', email: 'a@b.com' }

  it('wraps tables with app + account + timestamp metadata', () => {
    const doc = buildExportDocument(account, { supplies: [{ id: 's1' }] }, '2026-06-20T00:00:00.000Z')
    expect(doc.app).toBe('T1D Supply Hub')
    expect(doc.exportedAt).toBe('2026-06-20T00:00:00.000Z')
    expect(doc.account).toEqual(account)
    expect(doc.data.supplies).toHaveLength(1)
  })

  it('preserves empty tables and a null email', () => {
    const doc = buildExportDocument({ id: 'u-2', email: null }, { supplies: [] }, 'x')
    expect(doc.account.email).toBeNull()
    expect(doc.data.supplies).toEqual([])
  })
})

describe('EXPORT_SOURCES', () => {
  it('scopes caregiver_shares by owner_id and profiles by id', () => {
    const shares = EXPORT_SOURCES.find(s => s.table === 'caregiver_shares')
    const profiles = EXPORT_SOURCES.find(s => s.table === 'profiles')
    expect(shares?.column).toBe('owner_id')
    expect(profiles?.column).toBe('id')
  })

  it('scopes the PHI supply tables by user_id', () => {
    for (const t of ['supplies', 'prescriptions', 'medical_profiles']) {
      expect(EXPORT_SOURCES.find(s => s.table === t)?.column).toBe('user_id')
    }
  })
})
