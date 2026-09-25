export type DefaultScalar = string | number | boolean | null
export type DefaultScalarResult =
  { valid: true; value: DefaultScalar } | { valid: false; error: string }

export function parseDefaultScalar(text: string): DefaultScalarResult {
  if (!text.trim()) return { valid: true, value: null }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {
      valid: false,
      error: 'Gunakan JSON scalar: 0, false, "teks", atau null. Teks harus diapit tanda kutip.',
    }
  }
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  ) {
    return {
      valid: false,
      error:
        'Angka harus finite dan dalam batas integer aman. Untuk angka besar atau presisi exact, gunakan string bertanda kutip.',
    }
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return { valid: true, value }
  }
  return {
    valid: false,
    error:
      'Default hanya menerima string, angka, boolean, atau null; array dan object tidak didukung.',
  }
}

export function formatDefaultScalar(value: DefaultScalar | undefined): string {
  return value === undefined || value === null ? '' : JSON.stringify(value)
}
