import { describe, expect, it } from 'vitest'
import {
  configurationIssues,
  normalizeConfiguration,
  positiveDecimal,
} from '../../src/lib/configurationValidation'
import type { Column, ETL } from '../../src/lib/etl'

function draft(): ETL {
  return {
    schema_version: '1.0',
    columns: [
      {
        source_column: 'Amount',
        target_column: 'amount',
        target_type: 'numeric',
        numeric_precision: 20,
        numeric_scale: 2,
        transformation_codes: [],
        currency_conversion: {
          from_currency: 'USD',
          to_currency: 'IDR',
          rate: '12345.123456789012345678',
          rate_date: '2026-09-09',
          rate_reference: 'Synthetic example',
          output_scale: 2,
          rounding: 'HALF_UP',
          on_error: 'REJECT_ROW',
        },
      } as Column,
    ],
    data_quality_rules: [],
    semantic: { code: 'SALES', metrics: [], dimensions: [], allowed_roles: ['VIEWER'] },
  } as unknown as ETL
}
describe('BE12 configuration validation', () => {
  it('retains precise decimal strings and untouched metadata without mutating the draft', () => {
    const value = draft()
    const candidate = normalizeConfiguration(value)
    expect(configurationIssues(candidate)).toEqual([])
    expect(candidate.columns[0]!.currency_conversion!.rate).toBe('12345.123456789012345678')
    expect(candidate.semantic).toEqual(value.semantic)
    candidate.columns[0]!.currency_conversion!.rate = '2'
    expect(value.columns[0]!.currency_conversion!.rate).toBe('12345.123456789012345678')
  })
  it('rejects invalid precision, non-integer numbers and inconsistent conversion scales', () => {
    const value = draft(),
      c = value.columns[0]!
    c.numeric_precision = 1
    c.numeric_scale = 2.5
    expect(
      configurationIssues(value)
        .map((issue) => issue.message)
        .join(' '),
    ).toContain('integer')
    expect(
      configurationIssues(value)
        .map((issue) => issue.message)
        .join(' '),
    ).toContain('melebihi')
    c.numeric_precision = null
    expect(
      configurationIssues(value).some((issue) => issue.message.includes('terlebih dahulu')),
    ).toBe(true)
    c.numeric_precision = 20
    c.numeric_scale = null
    expect(configurationIssues(value).some((issue) => issue.message.includes('Skala output'))).toBe(
      true,
    )
    c.numeric_precision = Infinity
    expect(
      configurationIssues(normalizeConfiguration(value)).some((issue) =>
        issue.field.includes('numeric_precision'),
      ),
    ).toBe(true)
  })
  it('rejects conversion on keys or wrong types and simultaneous conversions', () => {
    const value = draft(),
      c = value.columns[0]!
    c.is_business_key = true
    expect(configurationIssues(value).some((issue) => issue.message.includes('non-key'))).toBe(true)
    c.is_business_key = false
    c.target_type = 'text'
    expect(configurationIssues(value).some((issue) => issue.field.endsWith('target_type'))).toBe(
      true,
    )
    c.unit_conversion = {
      from_unit: 'KG',
      to_unit: 'G',
      factor: '1000',
      output_scale: 2,
      rounding: 'DOWN',
      on_error: 'REJECT_ROW',
    }
    expect(
      configurationIssues(value).some((issue) => issue.message.includes('satu konversi')),
    ).toBe(true)
  })
  it('checks exact unit ratio and dimension, including exponent notation', () => {
    const value = draft(),
      c = value.columns[0]!
    c.currency_conversion = null
    c.unit_conversion = {
      from_unit: 'KG',
      to_unit: 'G',
      factor: '1.000e3',
      output_scale: 2,
      rounding: 'DOWN',
      on_error: 'REJECT_ROW',
    }
    expect(configurationIssues(value)).toEqual([])
    c.unit_conversion.factor = '1000.000000000001'
    expect(configurationIssues(value).some((issue) => issue.field.endsWith('.factor'))).toBe(true)
    c.unit_conversion.to_unit = 'ML'
    expect(configurationIssues(value).some((issue) => issue.message.includes('dimensi'))).toBe(true)
  })
  it('rejects missing currency metadata, invalid calendars, unsupported pairs and rates', () => {
    const value = draft(),
      conversion = value.columns[0]!.currency_conversion!
    conversion.rate_date = '2026-02-30'
    conversion.rate_reference = ' '
    conversion.to_currency = 'USD'
    conversion.rate = '-1'
    expect(configurationIssues(value)).toHaveLength(4)
    conversion.rate_date = '2024-02-29'
    conversion.rate_reference = 'Reference'
    conversion.to_currency = 'IDR'
    conversion.rate = '1'
    expect(configurationIssues(value)).toEqual([])
    for (const invalid of ['NaN', 'Infinity', '0', '1e99999', '1,23', '0.0000000000000000001'])
      expect(positiveDecimal(invalid, 30, 18)).toBeNull()
  })
  it('normalizes only empty optional parameters and preserves zero, false, empty-string defaults', () => {
    const value = draft(),
      c = value.columns[0]!
    Object.assign(c, {
      date_format: '',
      source_timezone: '  ',
      numeric_precision: '',
      numeric_scale: '',
      varchar_length: '',
    })
    Object.assign(value, {
      data_quality_rules: [
        { column: 'amount', rule: 'min', threshold_percent: 0, default_value: false, owner: '' },
        { column: 'amount', rule: 'min', default_value: '' },
      ],
    })
    const normalized = normalizeConfiguration(value)
    expect(normalized.columns[0]).toMatchObject({
      date_format: null,
      source_timezone: null,
      numeric_precision: null,
      numeric_scale: null,
      varchar_length: null,
    })
    expect(normalized.data_quality_rules[0]).toMatchObject({
      threshold_percent: 0,
      default_value: false,
      owner: null,
    })
    expect(normalized.data_quality_rules[1]!.default_value).toBe('')
    expect(c.date_format).toBe('')
  })
  it('checks timezone/type and locale/date parsing dependencies', () => {
    const value = draft(),
      c = value.columns[0]!
    c.source_timezone = 'Asia/Jakarta'
    c.date_format = '%d/%m/%Y'
    c.number_locale = 'US'
    expect(
      configurationIssues(value).some((issue) => issue.field.endsWith('.source_timezone')),
    ).toBe(true)
    expect(configurationIssues(value).some((issue) => issue.field.endsWith('.date_format'))).toBe(
      true,
    )
    expect(configurationIssues(value).some((issue) => issue.field.endsWith('.number_locale'))).toBe(
      true,
    )
  })
})
