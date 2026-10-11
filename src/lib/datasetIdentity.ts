function businessPart(value: string) {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function codePart(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function normalizeProductCode(value: string) {
  if (!value.trim() || /^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(value)) return value.trim()
  let code = codePart(value)
  if (!/^[a-z]/.test(code)) code = `dataset_${code}`
  return code.slice(0, 63).replace(/_+$/, '')
}

export function suggestDatasetIdentity(fileName: string, sheetName: string) {
  const file = businessPart(fileName)
  const sheet = businessPart(sheetName)
  const businessName = file && sheet
    ? `${file.slice(0, Math.max(1, 197 - Math.min(sheet.length, 100)))} / ${sheet.slice(0, 100)}`
    : (file || sheet).slice(0, 200)
  const fileCode = codePart(file)
  const sheetCode = codePart(sheet)
  let code = [fileCode, sheetCode].filter(Boolean).join('_')
  if (!/^[a-z]/.test(code)) code = `dataset_${code}`.replace(/_+$/, '')
  if (code.length > 63 && fileCode && sheetCode) {
    const suffix = sheetCode.slice(0, 40).replace(/_+$/, '')
    const prefix = (/^[a-z]/.test(fileCode) ? fileCode : `dataset_${fileCode}`)
      .slice(0, 62 - suffix.length).replace(/_+$/, '')
    code = `${prefix}_${suffix}`
  }
  return { businessName, code: code.slice(0, 63).replace(/_+$/, '') }
}
