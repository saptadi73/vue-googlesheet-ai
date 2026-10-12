import { describe, expect, it } from 'vitest'
import { getEtlStepGuide } from '../../src/lib/etlStepGuides'

describe('ETL contextual step guides', () => {
  it('offers an actionable guide for each of the seven steps', () => {
    for (let index = 0; index < 7; index += 1) {
      const guide = getEtlStepGuide(index, true)
      expect(guide?.title).toContain(`${index + 1}.`)
      expect(guide?.instructions.length).toBeGreaterThan(0)
    }
  })

  it('keeps owner-managed validation free of obsolete approval steps', () => {
    const guide = getEtlStepGuide(6, true)!
    expect(guide.instructions.join(' ')).toContain('Tidak perlu mengajukan approval konfigurasi')
    expect(guide.instructions.join(' ')).not.toContain('Ajukan review')
  })

  it('retains the legacy review path for configurations that still use it', () => {
    expect(getEtlStepGuide(6, false)?.instructions.join(' ')).toContain('Ajukan review')
    expect(getEtlStepGuide(-1, true)).toBeNull()
    expect(getEtlStepGuide(7, true)).toBeNull()
  })
})
