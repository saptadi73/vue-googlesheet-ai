import { currencies, roundings, type ETL } from './etl'

export interface ConfigurationIssue {
  field: string
  message: string
}
const unitDefinitions: Record<string, [string, number]> = {
  T: ['mass', 3],
  KG: ['mass', 0],
  G: ['mass', -3],
  MG: ['mass', -6],
  L: ['volume', 0],
  ML: ['volume', -3],
  M: ['length', 0],
  CM: ['length', -2],
  MM: ['length', -3],
}

// Parse decimal strings without passing the coefficient through a JS number.
export function positiveDecimal(value: unknown, maxDigits: number, places: number) {
  if (typeof value !== 'string' || value.length > 1000) return null
  const match = /^\+?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(value.trim())
  if (!match) return null
  const fraction = match[2] ?? match[3] ?? ''
  let digits = `${match[1] ?? ''}${fraction}`.replace(/^0+/, '')
  if (!digits) return null
  let exponent = Number(match[4] ?? 0) - fraction.length
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) return null
  const trailing = digits.length - digits.replace(/0+$/, '').length
  digits = digits.slice(0, digits.length - trailing)
  exponent += trailing
  const decimals = Math.max(0, -exponent)
  const whole = Math.max(0, digits.length + exponent)
  if (
    decimals > places ||
    whole > maxDigits - places ||
    Math.max(digits.length + Math.max(exponent, 0), decimals) > maxDigits
  )
    return null
  return { digits, exponent }
}

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function normalizeConfiguration(draft: ETL): ETL {
  // Unlike JSON stringify, preserve non-finite input until validation rejects it.
  const clone = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(clone)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
        : value
  const result = clone(draft) as ETL
  for (const column of result.columns) {
    for (const key of [
      'numeric_precision',
      'numeric_scale',
      'varchar_length',
      'date_format',
      'number_locale',
      'source_timezone',
      'unit_conversion',
      'currency_conversion',
    ] as const) {
      if (typeof column[key] === 'string' && !String(column[key]).trim()) column[key] = null
    }
  }
  for (const rule of result.data_quality_rules) {
    for (const key of ['threshold_percent', 'max_age_days', 'owner'] as const) {
      if (typeof rule[key] === 'string' && !String(rule[key]).trim()) rule[key] = null
    }
  }
  return result
}

export function configurationIssues(config: ETL): ConfigurationIssue[] {
  const issues: ConfigurationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const integer = (value: unknown, min: number, max: number, field: string, required = false) => {
    if (value == null && !required) return
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
      add(field, `Wajib integer ${min}..${max}.`)
  }
  for (const [index, c] of config.columns.entries()) {
    const path = `columns[${index}] (${c.source_column})`
    integer(c.numeric_precision, 1, 100, `${path}.numeric_precision`)
    integer(c.numeric_scale, 0, 50, `${path}.numeric_scale`)
    integer(c.varchar_length, 1, 10485760, `${path}.varchar_length`)
    if (c.numeric_scale != null && c.numeric_precision == null)
      add(`${path}.numeric_scale`, 'Isi numeric_precision terlebih dahulu.')
    if (
      c.numeric_scale != null &&
      c.numeric_precision != null &&
      c.numeric_scale > c.numeric_precision
    )
      add(`${path}.numeric_scale`, 'Scale tidak boleh melebihi precision.')
    if ((c.numeric_precision != null || c.numeric_scale != null) && c.target_type !== 'numeric')
      add(
        `${path}.target_type`,
        'Precision/scale hanya untuk numeric; hapus parameter sebelum mengganti tipe.',
      )
    if (c.varchar_length != null && !['text', 'varchar'].includes(c.target_type))
      add(`${path}.varchar_length`, 'Panjang varchar hanya untuk text/varchar.')
    if (
      c.date_format != null &&
      (c.date_format.length > 40 || !c.transformation_codes.includes('parse_date_id'))
    )
      add(`${path}.date_format`, 'Pola maksimal 40 karakter dan memerlukan parse_date_id.')
    if (
      c.number_locale != null &&
      (!['ID', 'US'].includes(c.number_locale) ||
        !c.transformation_codes.includes('parse_decimal_id'))
    )
      add(`${path}.number_locale`, 'Locale ID/US memerlukan parse_decimal_id.')
    if (
      c.source_timezone != null &&
      (c.source_timezone.length > 100 ||
        c.target_type !== 'timestamptz' ||
        c.transformation_codes.includes('parse_date_id'))
    )
      add(
        `${path}.source_timezone`,
        'Timezone maksimal 100 karakter, hanya untuk timestamptz tanpa parse_date_id. Zona IANA diperiksa backend.',
      )
    if (c.unit_conversion && c.currency_conversion)
      add(`${path}.unit_conversion`, 'Pilih hanya satu konversi satuan atau currency.')
    for (const kind of ['unit_conversion', 'currency_conversion'] as const) {
      const conversion = c[kind]
      if (!conversion) continue
      const field = `${path}.${kind}`
      if (c.target_type !== 'numeric' || c.is_business_key || c.is_primary_key)
        add(field, 'Konversi hanya untuk numeric non-key.')
      integer(conversion.output_scale, 0, 50, `${field}.output_scale`, true)
      if (!roundings.includes(conversion.rounding))
        add(`${field}.rounding`, 'Pilih HALF_UP, HALF_EVEN, atau DOWN.')
      if (conversion.on_error != null && conversion.on_error !== 'REJECT_ROW')
        add(`${field}.on_error`, 'Hanya REJECT_ROW yang didukung.')
      if (c.numeric_precision != null && (c.numeric_scale ?? 0) !== conversion.output_scale)
        add(`${field}.output_scale`, 'Skala output harus sama dengan numeric_scale (default 0).')
    }
    const unit = c.unit_conversion
    if (unit) {
      const from = unitDefinitions[unit.from_unit],
        to = unitDefinitions[unit.to_unit]
      const factor = positiveDecimal(unit.factor, 20, 12)
      if (!from || !to || from[0] !== to[0] || unit.from_unit === unit.to_unit)
        add(`${path}.unit_conversion`, 'Pilih unit berbeda dalam dimensi yang sama.')
      else if (!factor || factor.digits !== '1' || factor.exponent !== from[1] - to[1])
        add(
          `${path}.unit_conversion.factor`,
          'Faktor harus sama dengan rasio unit; maksimal 20 digit dan 12 desimal.',
        )
    }
    const currency = c.currency_conversion
    if (currency) {
      if (
        !currencies.includes(currency.from_currency) ||
        !currencies.includes(currency.to_currency) ||
        currency.from_currency === currency.to_currency
      )
        add(`${path}.currency_conversion`, 'Pilih dua currency berbeda yang didukung.')
      if (!positiveDecimal(currency.rate, 30, 18))
        add(
          `${path}.currency_conversion.rate`,
          'Kurs harus string desimal positif finite, maksimal 30 digit dan 18 desimal.',
        )
      if (!validCalendarDate(currency.rate_date))
        add(`${path}.currency_conversion.rate_date`, 'Isi tanggal kalender YYYY-MM-DD yang valid.')
      if (!currency.rate_reference.trim() || currency.rate_reference.length > 500)
        add(
          `${path}.currency_conversion.rate_reference`,
          'Referensi kurs wajib, maksimal 500 karakter.',
        )
    }
  }
  for (const [index, rule] of config.data_quality_rules.entries()) {
    const path = `data_quality_rules[${index}] (${rule.column})`
    if (
      rule.threshold_percent != null &&
      (!Number.isFinite(rule.threshold_percent) ||
        rule.threshold_percent < 0 ||
        rule.threshold_percent > 100)
    )
      add(`${path}.threshold_percent`, 'Threshold harus 0..100.')
    integer(rule.max_age_days, 0, 36500, `${path}.max_age_days`, rule.rule === 'max_age_days')
    if (
      rule.rule === 'max_age_days' &&
      !config.columns.some(
        (c) =>
          c.target_column === rule.column &&
          ['date', 'timestamp', 'timestamptz'].includes(c.target_type),
      )
    )
      add(`${path}.column`, 'max_age_days hanya untuk kolom tanggal/waktu.')
  }
  return issues
}
