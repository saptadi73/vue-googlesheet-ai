import { call, type Config, type Sheet, type SheetClassification } from './etl'

export function classificationEvidenceMatches(
  config: Config,
  classification: SheetClassification | undefined,
) {
  return (
    !!classification?.execution_ready &&
    config.review_state?.classification_revision === classification.revision_no &&
    config.review_state?.dataset_kind === classification.dataset_kind
  )
}
export function sourceBlockers(sheets: Sheet[]): string[] {
  const enabled = sheets.filter((sheet) => sheet.enabled)
  if (!enabled.length) return ['Tidak ada tab enabled untuk dimuat.']
  return enabled.flatMap((sheet) => {
    if (sheet.classification_status !== 'CONFIRMED' || !sheet.dataset_kind)
      return [`${sheet.sheet_name}: klasifikasi belum dikonfirmasi.`]
    if (sheet.dataset_kind === 'MASTER')
      return [`${sheet.sheet_name}: runtime master belum tersedia (MASTER_RUNTIME_PENDING).`]
    return []
  })
}
export async function ensureSourceReady(sourceId: string) {
  const sheets = await call<Sheet[]>('GET', `/sources/${encodeURIComponent(sourceId)}/sheets`)
  const blockers = sourceBlockers(sheets)
  if (blockers.length)
    throw new Error(
      `Sync sumber tertahan:\n${blockers.join('\n')}\nBuka Workspace ETL untuk memeriksa seluruh tab enabled.`,
    )
}
