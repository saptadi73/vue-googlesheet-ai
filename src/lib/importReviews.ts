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

export type ImportQuestionStatus = 'OPEN' | 'ANSWERED' | 'PENDING_APPROVAL' | 'CANCELLED'
export type ImportQuestionCategory =
  | 'TAXONOMY_AMBIGUOUS'
  | 'TAXONOMY_INVALID'
  | 'DATA_QUALITY'
  | 'DUPLICATE_KEY'
  | 'DATA_QUALITY_WARNING'
  | 'CONFIGURATION'
  | 'AI_REVIEW'
export type ImportQuestionAction =
  'APPLY_CORRECTION' | 'CORRECT_SOURCE' | 'PROPOSE_MASTER' | 'KEEP_ORIGINAL' | 'SELECT_RECORD'

export interface ImportCheckpoint {
  close_open_periods?: boolean
  effective_plan_hash?: string
  periods_to_close?: number
  periods_closed?: number
  rows_applied?: number
  deterministic_complete?: boolean
  rows_valid?: number
  rows_invalid?: number
  warning_count?: number
  blocking_codes?: string[]
  ai_coverage?: string
  ai_reviewed_rows?: number[]
  ai_masked_fields?: string[]
  ai_metadata?: Record<string, unknown>[]
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

export interface ImportQuestionCandidate {
  id: string
  label?: string
  [key: string]: unknown
}

export interface ImportQuestion {
  id: string
  import_review_id: string
  staging_row_id: string | null
  source_row?: number
  source_column: string | null
  target_column: string | null
  category: ImportQuestionCategory
  prompt: string
  mandatory: boolean
  allowed_actions: ImportQuestionAction[]
  candidates: ImportQuestionCandidate[]
  candidate_count: number
  status: ImportQuestionStatus
  revision_no: number
  decisions: unknown[]
  proposed_master_definition_id?: string | null
}

export interface ImportQuestionDecision {
  revision_no: number
  action: ImportQuestionAction
  reason?: string
  corrected_value?: unknown
  selected_candidate_id?: string
  master_proposal?: unknown
}

export interface ImportQuestionActionResponse {
  question: ImportQuestion | null
  review: ImportReview
  stale: boolean
}

export interface ImportQuestionResolve {
  revision_no: number
  master_definition_id: string
}

export interface ImportQuestionList {
  items: ImportQuestion[]
  has_more: boolean
}

export interface ImportPreviewChange {
  source_row?: number
  operation?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface ImportReviewPreview {
  blocking_codes?: string[]
  source_conflicts?: Array<{ source_row?: number; record_id: string; action?: string }>
  requires_source_confirmation?: boolean
  period_closures?: Array<{
    record_id: string
    revision_no: number
    column: string
    before: null
    after: string
  }>
  review: ImportReview
  target: string
  changes: ImportPreviewChange[]
  summary: Record<string, unknown>
  preview_hash: string
  preview_token?: string
  preview_revision?: number
  masked_fields?: string[]
  read_only?: boolean
  can_approve: boolean
}

export interface ImportReviewApplyResult {
  periods_closed?: number
  review: ImportReview
  rows_applied: number
}

export interface ImportReferenceResolveResult {
  status: 'ALIAS' | 'EXACT' | 'EMPTY' | 'CANDIDATE' | 'AMBIGUOUS' | 'NOT_FOUND'
  requires_question?: boolean
  revision_no?: number
  master_id: string
  record?: Record<string, unknown>
  candidates?: Record<string, unknown>[]
  staging_updated?: boolean
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

export async function listImportReviewQuestions(
  reviewId: string,
  status = '',
  category = '',
  offset = 0,
  limit = 50,
) {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (status) query.set('status', status)
  if (category) query.set('category', category)
  return call<ImportQuestionList>('GET', `/import-reviews/${reviewId}/questions?${query}`)
}

export async function answerImportReviewQuestion(
  reviewId: string,
  questionId: string,
  payload: ImportQuestionDecision,
) {
  return call<ImportQuestionActionResponse>(
    'POST',
    `/import-reviews/${reviewId}/questions/${questionId}/answer`,
    payload,
  )
}

export async function resolveImportReviewMasterProposal(
  reviewId: string,
  questionId: string,
  payload: ImportQuestionResolve,
) {
  return call<ImportQuestionActionResponse>(
    'POST',
    `/import-reviews/${reviewId}/questions/${questionId}/resolve-master-proposal`,
    payload,
  )
}

export async function previewImportReview(
  reviewId: string,
  revisionNo: number,
  closeOpenPeriods = false,
) {
  return call<ImportReviewPreview>('POST', `/import-reviews/${reviewId}/preview`, {
    revision_no: revisionNo,
    close_open_periods: closeOpenPeriods,
  })
}

export function readImportReviewPreview(reviewId: string) {
  return call<ImportReviewPreview>('GET', `/import-reviews/${reviewId}/preview`)
}

export async function approveImportReview(
  reviewId: string,
  revisionNo: number,
  comment: string,
  previewHash: string,
  acceptSourceConflicts = false,
) {
  return call<ImportReview>('POST', `/import-reviews/${reviewId}/approve`, {
    revision_no: revisionNo,
    comment: comment.trim(),
    preview_hash: previewHash,
    accept_source_conflicts: acceptSourceConflicts,
  })
}

export async function applyImportReview(
  reviewId: string,
  revisionNo: number,
  previewToken: string,
) {
  return call<ImportReviewApplyResult>('POST', `/import-reviews/${reviewId}/apply`, {
    revision_no: revisionNo,
    preview_token: previewToken,
  })
}

export async function resolveImportReference(
  reviewId: string,
  revisionNo: number,
  masterDefinitionId: string,
  value: string,
  sourceColumn: string,
  stagingRowId?: string,
  targetColumn?: string,
) {
  if (!sourceColumn.trim()) throw new Error('Kolom sumber referensi wajib diisi.')
  if (!!stagingRowId !== !!targetColumn)
    throw new Error('UUID staging dan kolom target harus diisi bersama.')
  return call<ImportReferenceResolveResult>(
    'POST',
    `/import-reviews/${reviewId}/resolve-reference`,
    {
      revision_no: revisionNo,
      master_definition_id: masterDefinitionId,
      value,
      source_column: sourceColumn.trim(),
      ...(stagingRowId && targetColumn
        ? { staging_row_id: stagingRowId, target_column: targetColumn }
        : {}),
    },
  )
}
