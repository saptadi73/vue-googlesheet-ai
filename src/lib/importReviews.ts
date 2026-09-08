import { call } from './etl'

export type ImportStatus =
  | 'VALIDATING'
  | 'AI_REVIEWING'
  | 'NEEDS_INPUT'
  | 'FAILED'
  | 'STALE_REVIEW'
  | 'CANCELLED'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'APPLYING'
  | 'SUCCEEDED'

export interface ImportCheckpoint {
  deterministic_complete?: boolean
  rows_valid?: number
  rows_invalid?: number
  warning_count?: number
  blocking_codes?: string[]
  ai_coverage?: string
  last_error_code?: string | null
}

export interface ImportReview {
  id: string
  source_id: string
  source_sheet_id: string
  snapshot_id: string
  snapshot_hash: string
  created_by: string
  created_at: string
  status: ImportStatus
  revision_no: number
  generation: number
  job_id: string | null
  dataset_kind: 'MASTER' | 'NON_MASTER'
  configuration_id: string | null
  configuration_revision: number | null
  master_id: string | null
  master_version: number | null
  policy: Record<string, unknown>
  checkpoint: ImportCheckpoint
  finding_count: number
  dependencies_current?: boolean
  execution_ready: boolean
}

export interface Finding {
  source_row?: number
  column?: string | null
  code?: string
  severity?: string
  message?: string
  location?: string
}

export interface ImportList {
  items: ImportReview[]
  has_more: boolean
}

export async function createImportReview(sourceSheetId: string, configurationId?: string) {
  return call<{ review: ImportReview; reused: boolean }>('POST', '/import-reviews', {
    source_sheet_id: sourceSheetId,
    ...(configurationId ? { configuration_id: configurationId } : {}),
  })
}
