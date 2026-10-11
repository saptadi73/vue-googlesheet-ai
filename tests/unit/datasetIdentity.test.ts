import { describe, expect, it } from 'vitest'
import { normalizeProductCode, suggestDatasetIdentity } from '../../src/lib/datasetIdentity'

describe('dataset identity from file and tab', () => {
  it('normalizes invalid entered codes but preserves valid existing codes and empty input', () => {
    expect(normalizeProductCode('Keluhan 2026 / ANGGOTA')).toBe('keluhan_2026_anggota')
    expect(normalizeProductCode('SALES_2026')).toBe('SALES_2026')
    expect(normalizeProductCode('')).toBe('')
    expect(normalizeProductCode('123 Keluhan')).toBe('dataset_123_keluhan')
    expect(normalizeProductCode('Nama '.repeat(40))).toMatch(/^[a-z][a-z0-9_]{0,62}$/)
  })
  it('uses both names and replaces invalid product punctuation with underscores', () => {
    expect(suggestDatasetIdentity('Keluhan KAN Jabung 2026', 'REKAP JENIS KELUHAN')).toEqual({
      businessName: 'Keluhan KAN Jabung 2026 / REKAP JENIS KELUHAN',
      code: 'keluhan_kan_jabung_2026_rekap_jenis_keluhan',
    })
  })
  it('preserves valid business punctuation and replaces control characters with spaces', () => {
    expect(suggestDatasetIdentity("PT. JAR & Co.\n2026", "Biaya (Rp) / 'Aktif'")).toEqual({
      businessName: "PT. JAR & Co. 2026 / Biaya (Rp) / 'Aktif'",
      code: 'pt_jar_co_2026_biaya_rp_aktif',
    })
  })
  it.each([
    ['123', '45'],
    ['---', '!!!'],
    ['Café', '東京'],
    ['A'.repeat(250), 'B'.repeat(150)],
    ['', 'Tab'],
  ])('respects backend length and identifier constraints for %s / %s', (file, sheet) => {
    const identity = suggestDatasetIdentity(file, sheet)
    expect(identity.businessName.length).toBeLessThanOrEqual(200)
    expect(identity.code).toMatch(/^[a-z][a-z0-9_]{0,62}$/)
  })
  it('keeps distinct tab names when the file name exceeds the product code limit', () => {
    const first = suggestDatasetIdentity('File'.repeat(50), 'BSP')
    const second = suggestDatasetIdentity('File'.repeat(50), 'ANGKUTAN')
    expect(first.code).toMatch(/_bsp$/)
    expect(second.code).toMatch(/_angkutan$/)
    expect(first.code).not.toBe(second.code)
  })
})
