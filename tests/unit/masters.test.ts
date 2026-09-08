import { describe, expect, it } from 'vitest'
import { blankDefinition, bindingColumns, validateDefinition } from '../../src/lib/masters'
import { classificationEvidenceMatches, sourceBlockers } from '../../src/lib/classification'
import type { Sheet, Config, SheetClassification } from '../../src/lib/etl'
describe('BE02 classification gates', () => {
  const sheet = {
    sheet_name: 'Transaksi',
    enabled: true,
    dataset_kind: 'NON_MASTER',
    classification_status: 'CONFIRMED',
  } as Sheet
  it('checks every enabled tab and ignores disabled master tabs', () => {
    expect(
      sourceBlockers([sheet, { ...sheet, sheet_name: 'Produk', dataset_kind: 'MASTER' }]),
    ).toEqual([expect.stringContaining('Produk')])
    expect(sourceBlockers([sheet, { ...sheet, dataset_kind: 'MASTER', enabled: false }])).toEqual(
      [],
    )
    expect(
      sourceBlockers([
        { ...sheet, dataset_kind: null, classification_status: 'CLASSIFICATION_REQUIRED' },
      ]),
    ).toHaveLength(1)
    expect(sourceBlockers([])).toHaveLength(1)
  })
  it('requires exact classification revision even when kind changes back', () => {
    const config = {
      review_state: { classification_revision: 2, dataset_kind: 'NON_MASTER' },
    } as Config
    const classification = {
      execution_ready: true,
      revision_no: 2,
      dataset_kind: 'NON_MASTER',
    } as SheetClassification
    expect(classificationEvidenceMatches(config, classification)).toBe(true)
    expect(classificationEvidenceMatches(config, { ...classification, revision_no: 4 })).toBe(false)
    expect(classificationEvidenceMatches(config, undefined)).toBe(false)
    expect(
      classificationEvidenceMatches(config, { ...classification, execution_ready: false }),
    ).toBe(false)
  })
})
describe('BE03 definitions and approved mapping', () => {
  function definition() {
    const value = blankDefinition()
    value.name = 'Produk'
    value.fields = [
      { name: 'code', type: 'text', nullable: false, pii_classification: 'HIGH' },
      { name: 'label', type: 'text', nullable: true, pii_classification: 'NONE' },
    ]
    value.business_key = ['code']
    value.label_field = 'label'
    return value
  }
  it('retains the explicit PROPOSE_INSERT policy and immutable constraints', () => {
    expect(definition().policy).toMatchObject({
      new_record_policy: 'PROPOSE_INSERT',
      source_conflict_policy: 'REQUIRE_REVIEW',
      missing_record_policy: 'KEEP',
      delete_referenced_policy: 'RESTRICT',
    })
    expect(() => validateDefinition(definition())).not.toThrow()
  })
  it('rejects nullable keys and invalid effective dating', () => {
    const value = definition()
    value.fields[0]!.nullable = true
    expect(() => validateDefinition(value)).toThrow('business key')
    value.fields[0]!.nullable = false
    value.policy.effective_dating = {
      valid_from_column: 'code',
      valid_to_column: 'label',
      interval: 'START_INCLUSIVE_END_EXCLUSIVE',
      overlap_policy: 'REJECT',
    }
    expect(() => validateDefinition(value)).toThrow('Masa berlaku')
  })
  it('maps exact approved types/PII/keys and never invents primary keys', () => {
    const columns = bindingColumns(definition(), {
      code: { source: 'Kode', transforms: ['trim', 'uppercase'] },
      label: { source: 'Nama', transforms: [] },
    })
    expect(columns[0]).toMatchObject({
      target_type: 'text',
      pii_classification: 'HIGH',
      is_business_key: true,
      is_primary_key: false,
      nullable: false,
      transformation_codes: ['trim', 'uppercase'],
    })
  })
  it('requires label even if nullable and rejects reused source headers', () => {
    expect(() =>
      bindingColumns(definition(), { code: { source: 'Kode', transforms: [] } }),
    ).toThrow('label')
    expect(() =>
      bindingColumns(definition(), {
        code: { source: 'Kode', transforms: [] },
        label: { source: 'Kode', transforms: [] },
      }),
    ).toThrow('sekali')
  })
})
