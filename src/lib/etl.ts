import { ref } from 'vue'
import {
  api,
  clearSession,
  onSessionCleared,
  restoreSessionTokens,
  setSession,
  type TokenPair,
  type ApiEnvelope,
} from './api'

export interface User {
  id: string
  tenant_id?: string
  username: string
  role: string
  full_name?: string
  is_active?: boolean
  row_scope?: Record<string, Record<string, unknown[]>>
}
export type AccessKind = 'DEPARTMENT' | 'BUSINESS_DOMAIN' | 'JURISDICTION' | 'CLEARANCE' | 'PURPOSE'
export interface AccessAttribute {
  id: string
  kind: AccessKind
  code: string
  label: string
  parent_id: string | null
  is_active: boolean
  revision: number
  attribute_data: Record<string, unknown>
}
export interface UserAssignment {
  id: string
  user_id: string
  attribute_id: string
  valid_from: string
  valid_to: string | null
  status: 'ACTIVE' | 'REVOKED'
  revision: number
  note: string
  revoked_at: string | null
  attribute: AccessAttribute
}
export type AccessAction =
  'DISCOVER' | 'READ' | 'QUERY' | 'EXPORT' | 'EDIT' | 'APPROVE' | 'OPERATE' | 'ADMIN'
export interface PermissionBundle {
  id: string
  code: string
  label: string
  description: string
  actions: AccessAction[]
  is_active: boolean
  revision: number
}
export interface PermissionGrant {
  id: string
  user_id: string
  bundle_id: string
  valid_from: string
  valid_to: string | null
  status: 'ACTIVE' | 'REVOKED'
  revision: number
  note: string
  revoked_at: string | null
  bundle: PermissionBundle
}
export interface AccessRequest {
  id: string
  requester_id: string
  subject_user_id: string
  request_type: 'ATTRIBUTE' | 'PERMISSION_BUNDLE'
  attribute_id: string | null
  bundle_id: string | null
  valid_from: string
  valid_to: string
  business_reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REVOKED'
  revision: number
  decision_note: string
  assignment_id: string | null
  permission_grant_id: string | null
  requester: { id: string; username: string; full_name?: string }
  subject_user: { id: string; username: string; full_name?: string; role: string }
  attribute: AccessAttribute | null
  bundle: PermissionBundle | null
}
export interface AccessRequestOptions {
  attributes: AccessAttribute[]
  permission_bundles: PermissionBundle[]
  requestable_users: Pick<User, 'id' | 'username' | 'full_name' | 'role'>[]
  max_duration_days: number
}
export interface AccessPolicy {
  id: string
  code: string
  label: string
  description: string
  effect: 'ALLOW' | 'DENY'
  actions: AccessAction[]
  required_attribute_ids: string[]
  row_scope: Record<string, string[]>
  column_rules: Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN'>
  export_allowed: boolean
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REVOKED'
  revision: number
  valid_from: string
  valid_to: string | null
  created_by: string
}
export interface AccessDecision {
  allowed: boolean
  reason_code: 'POLICY_MATCH' | 'EXPLICIT_DENY' | 'DEFAULT_DENY' | 'ACTION_NOT_GRANTED'
  policy_ids: string[]
  policy_revisions: Array<{ id: string; revision: number }>
  row_scope: Record<string, string[]>
  columns: Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN'>
  export_allowed: boolean
}
export interface EffectiveAccess {
  user: Pick<User, 'id' | 'username' | 'role' | 'is_active'>
  as_of: string
  actions: string[]
  dimensions: Partial<Record<AccessKind, string[]>>
  assignments: UserAssignment[]
  permission_grants: PermissionGrant[]
}
export const user = ref<User | null>(null)
onSessionCleared(() => {
  user.value = null
})
export const editRoles = ['PLATFORM_ADMIN', 'DATA_STEWARD', 'SOURCE_OWNER']
export const reviewRoles = ['PLATFORM_ADMIN', 'TECHNICAL_APPROVER']
export const roles = [...editRoles, 'TECHNICAL_APPROVER', 'ANALYST', 'VIEWER']
export const sections = ['identity', 'columns', 'cleansing', 'quality', 'load', 'semantic']
export const sectionLabels = [
  'Identitas',
  'Kolom',
  'Cleansing',
  'Kualitas data',
  'Pemuatan',
  'Analitik & akses',
]
export const types = [
  'text',
  'varchar',
  'integer',
  'bigint',
  'numeric',
  'boolean',
  'date',
  'timestamp',
  'timestamptz',
  'uuid',
]
export const transforms = [
  'trim',
  'normalize_whitespace',
  'parse_date_id',
  'parse_decimal_id',
  'uppercase',
  'lowercase',
  'null_if_empty',
  'prefix',
  'suffix',
  'replace',
]
export const roundings = ['HALF_UP', 'HALF_EVEN', 'DOWN']
export const numberLocales = ['ID', 'US']
export const unitsByDimension: Record<string, string[]> = {
  massa: ['T', 'KG', 'G', 'MG'],
  volume: ['L', 'ML'],
  panjang: ['M', 'CM', 'MM'],
}
export const units = Object.values(unitsByDimension).flat()
export const currencies = ['IDR', 'USD', 'EUR', 'SGD', 'JPY', 'THB']
export const qualityRules = [
  'not_null',
  'unique',
  'min',
  'max',
  'allowed_values',
  'format',
  'max_age_days',
  'in_taxonomy',
]
export const dqFormats = ['UUID', 'ISO_DATE', 'ISO_DATETIME']
export const dqSeverities = ['INFO', 'WARN', 'ERROR', 'CRITICAL']
export interface UnitConversion {
  from_unit: string
  to_unit: string
  factor: string
  output_scale: number
  rounding: string
  on_error: string
}
export interface CurrencyConversion {
  from_currency: string
  to_currency: string
  rate: string
  rate_date: string
  rate_reference: string
  output_scale: number
  rounding: string
  on_error: string
}
export interface TransformParameter {
  operation: 'prefix' | 'suffix' | 'replace'
  value: string
  replacement: string | null
}
export interface Column {
  taxonomy_id?: string | null
  taxonomy_version?: number | null
  taxonomy_required?: boolean
  source_column: string
  target_column: string
  target_type: string
  business_name: string
  nullable: boolean
  is_business_key: boolean
  is_primary_key: boolean
  transformation_codes: string[]
  transform_parameters?: TransformParameter[]
  pii_classification: string
  access_visibility?: 'VISIBLE' | 'MASKED' | 'HIDDEN'
  confidence: number
  reason: string
  numeric_precision: number | null
  numeric_scale: number | null
  varchar_length: number | null
  date_format: string | null
  number_locale: string | null
  source_timezone: string | null
  unit_conversion: UnitConversion | null
  currency_conversion: CurrencyConversion | null
}
export interface Quality {
  column: string
  rule: string
  value: string | number | string[] | null
  action_on_fail: string
  severity: string
  owner: string | null
  threshold_percent: number | null
  max_age_days: number | null
  default_value: string | number | boolean | null
}
export interface Metric {
  null_handling?: 'PRESERVE' | 'ZERO_RESULT'
  unit?: string | null
  synonyms?: string[]
  description?: string
  default_period?: { dimension: string; days: number } | null
  filters?: MetricFilter[]
  code: string
  label: string
  column: string
  aggregation: string
}
export interface MetricFilter {
  field: string
  operator: 'eq' | 'in' | 'between' | 'gte' | 'lte' | 'gt' | 'lt'
  value: string | number | boolean | Array<string | number>
}
export interface ETL {
  schema_version: string
  dataset_business_name: string
  dataset_description: string
  grain: string
  target_schema: string
  target_table: string
  load_strategy: string
  append_duplicate_policy?: 'SKIP_IDENTICAL' | 'REJECT_IDENTICAL' | null
  columns: Column[]
  data_quality_rules: Quality[]
  semantic: { code: string; dimensions: string[]; metrics: Metric[]; allowed_roles: string[] }
  unresolved_questions: string[]
  overall_confidence: number
}
export interface Config {
  id: string
  source_id: string
  source_sheet_id: string
  status: string
  version_no: number
  revision_no: number
  created_by: string
  configuration_json: ETL
  review_state: {
    submitted_revision?: number
    submitted_by?: string
    classification_revision?: number
    dataset_kind?: 'MASTER' | 'NON_MASTER'
    answers?: Record<string, { answer: string }>
  }
}
export interface SourceAccessMetadata {
  owner_unit_id: string
  business_domain_id: string
  jurisdiction_id: string
  purpose_id: string
  data_owner_user_id: string
  data_steward_user_id: string
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH'
}
export interface Source {
  id: string
  name: string
  source_code: string
  status: string
  access_status?: 'ACCESS_POLICY_REQUIRED' | 'POLICY_APPROVED'
  access_revision?: number
  access_metadata?: SourceAccessMetadata | null
  access_metadata_editor_id?: string | null
  access_review_status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  access_reviewed_by?: string | null
  access_review_reason?: string
  paused: boolean
  sync_schedule: string | null
  schedule_timezone: string
  concurrency_policy: 'QUEUE_LATEST' | 'SKIP_IF_RUNNING'
  schedule_revision: number
  dependency_source_ids: string[]
}
export interface Sheet {
  id: string
  sheet_name: string
  last_fingerprint: string | null
  range_a1: string
  header_row: number
  data_start_row: number
  enabled: boolean
  active_configuration_id: string | null
  dataset_kind: 'MASTER' | 'NON_MASTER' | null
  classification_status: 'CLASSIFICATION_REQUIRED' | 'CONFIRMED'
  classification_revision: number
  classification_confirmed_by: string | null
  classification_confirmed_at: string | null
  watermark_source_column: string | null
  watermark_kind: 'INTEGER' | 'DECIMAL' | 'DATE' | 'DATETIME' | null
  watermark_value: string | null
  watermark_updated_at: string | null
  watermark_revision: number
}
export interface Profile {
  id: string
  source_sheet_id: string
  created_at: string
  status: string
  profile_json: {
    row_count: number
    warnings: string[]
    columns: {
      source_column: string
      normalized_name: string
      inferred_type: string
      pii_suspected: boolean
      null_ratio: number
      distinct_ratio: number
    }[]
  }
}
export interface Validation {
  valid: boolean
  ready_for_review: boolean
  classification?: SheetClassification
  snapshot_hash?: string
  sample_rows_valid?: number
  sample_rows_invalid?: number
  row_previews?: {
    source_row: number
    before: Record<string, unknown>
    after: Record<string, unknown>
  }[]
  warnings?: unknown[]
  issues?: unknown[]
  errors?: { message: string }[]
  deployment_plan?: unknown
}
export interface Review {
  configuration: Config
  source: Source
  sheet: Sheet
  validation: Validation
  classification: SheetClassification
  profile: {
    columns: { source_column: string; inferred_type?: string; pii_suspected?: boolean }[]
  } | null
  capabilities: { unsupported: string[]; max_workbook_bytes: number }
}
export interface Preview {
  can_apply: boolean
  revision_no: number
  configuration: ETL | null
  question_answers: Record<string, string>
  preview_token: string | null
  diff: Record<string, { before: unknown; after: unknown }>
  errors: { location: string; message: string }[]
  validation?: Validation
}
export interface SheetClassification {
  schema_version: string
  classification_scope: 'SHEET'
  source_sheet_id: string
  dataset_kind: 'MASTER' | 'NON_MASTER' | null
  status: 'CLASSIFICATION_REQUIRED' | 'CONFIRMED'
  revision_no: number
  confirmed_by: string | null
  confirmed_at: string | null
  execution_ready: boolean
  blocking_reason: { code: string; message: string } | null
  master_binding?: unknown
}
export interface Job {
  id: string
  status: string
  error_message?: string
  error_code?: string
  result?: unknown
  kind?: string
  source_id?: string
  created_at?: string
}
export interface OperationalNotification {
  id: string
  kind: 'JOB_FAILED' | 'IMPORT_NEEDS_INPUT' | 'IMPORT_FAILED' | string
  severity: 'INFO' | 'WARN' | 'ERROR'
  resource_type: 'JOB' | 'IMPORT_REVIEW' | string
  resource_id: string
  title: string
  message: string
  details: Record<string, unknown>
  recipient_user_id: string | null
  acknowledged_by: string | null
  acknowledged_at: string | null
  created_at: string
}
export interface OperationalSummary {
  jobs: Record<string, number>
  import_reviews: Record<string, number>
  unacknowledged_notifications: number
  generated_at: string
}
export async function call<T>(method: string, url: string, data?: unknown): Promise<T> {
  return (await api.request<ApiEnvelope<T>>({ method, url, data })).data.data
}
export async function login(credentials: {
  tenant_code: string
  username: string
  password: string
}) {
  clearSession()
  const tokens = await call<TokenPair>('POST', '/auth/login', credentials)
  setSession(tokens)
  try {
    user.value = await call<User>('GET', '/auth/me')
  } catch (e) {
    clearSession()
    throw e
  }
}
export async function restoreSession() {
  if (!(await restoreSessionTokens())) return
  user.value = await call<User>('GET', '/auth/me')
}
export async function logout() {
  try {
    await call('POST', '/auth/logout')
  } finally {
    clearSession()
  }
}
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
