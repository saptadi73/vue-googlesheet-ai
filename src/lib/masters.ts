import type { Column, Validation } from './etl'
export interface MasterField {
  name: string
  type: string
  nullable: boolean
  pii_classification: string
}
export interface MasterDefinition {
  name: string
  description: string
  aliases: string[]
  fields: MasterField[]
  business_key: string[]
  label_field: string
  policy: {
    new_record_policy: 'PROPOSE_INSERT' | 'UPDATE_ONLY'
    source_conflict_policy: 'REQUIRE_REVIEW' | 'AUTHORITATIVE_SOURCE'
    authoritative_source_sheet_id: string | null
    missing_record_policy: 'KEEP'
    deactivation_policy: 'EXPLICIT_REVIEW'
    business_key_change_policy: 'EXPLICIT_MIGRATION'
    delete_referenced_policy: 'RESTRICT'
    effective_dating: {
      valid_from_column: string
      valid_to_column: string
      interval: 'START_INCLUSIVE_END_EXCLUSIVE'
      overlap_policy: 'REJECT'
    } | null
  }
}
export interface Master {
  id: string
  code: string
  name: string
  aliases: string[]
  definition_json: MasterDefinition
  approved_definition_json: MasterDefinition | null
  revision_no: number
  approved_version: number
  status: string
  is_active: boolean
  created_by: string
  submitted_by: string | null
  approved_by: string | null
  approved_at: string | null
}
export interface Candidate {
  id: string
  code: string
  name: string
  status: string
  is_active: boolean
  score: number
  reason: string
}
export interface Binding {
  id: string
  source_sheet_id: string
  master_definition_id: string
  master_version: number
  classification_revision: number
  revision_no: number
  status: string
  columns_json: Column[]
  fingerprint: string
  snapshot_hash: string
  created_by: string
  approved_by: string | null
  approved_at: string | null
}
export interface BindingDetail {
  binding: Binding | null
  validation?: Validation
  metadata_ready?: boolean
  execution_ready: boolean
  blocking_reason?: string
}
export function blankDefinition(): MasterDefinition {
  return {
    name: '',
    description: '',
    aliases: [],
    fields: [{ name: '', type: 'text', nullable: false, pii_classification: 'NONE' }],
    business_key: [],
    label_field: '',
    policy: {
      new_record_policy: 'PROPOSE_INSERT',
      source_conflict_policy: 'REQUIRE_REVIEW',
      authoritative_source_sheet_id: null,
      missing_record_policy: 'KEEP',
      deactivation_policy: 'EXPLICIT_REVIEW',
      business_key_change_policy: 'EXPLICIT_MIGRATION',
      delete_referenced_policy: 'RESTRICT',
      effective_dating: null,
    },
  }
}
export function validateDefinition(definition: MasterDefinition) {
  const fields = new Map(definition.fields.map((field) => [field.name, field]))
  if (
    !definition.name.trim() ||
    !definition.fields.length ||
    fields.size !== definition.fields.length ||
    definition.fields.some((f) => !/^[a-z][a-z0-9_]{0,62}$/.test(f.name))
  )
    throw new Error('Isi nama master dan field unik dengan identifier lowercase yang valid.')
  if (
    !definition.business_key.length ||
    definition.business_key.some((key) => !fields.has(key) || fields.get(key)?.nullable)
  )
    throw new Error('Pilih business key yang tersedia dan tidak nullable.')
  if (!fields.has(definition.label_field)) throw new Error('Pilih field label yang tersedia.')
  const period = definition.policy.effective_dating
  if (
    period &&
    (period.valid_from_column === period.valid_to_column ||
      !['date', 'timestamp', 'timestamptz'].includes(
        fields.get(period.valid_from_column)?.type || '',
      ) ||
      fields.get(period.valid_from_column)?.type !== fields.get(period.valid_to_column)?.type)
  )
    throw new Error('Masa berlaku membutuhkan dua field tanggal/waktu berbeda dengan tipe sama.')
  if (
    definition.policy.source_conflict_policy === 'AUTHORITATIVE_SOURCE' &&
    !definition.policy.authoritative_source_sheet_id
  )
    throw new Error('Isi UUID tab MASTER otoritatif yang telah dikonfirmasi.')
}
export function bindingColumns(
  definition: MasterDefinition,
  mapping: Record<string, { source: string; transforms: string[] }>,
): Column[] {
  const columns: Column[] = []
  for (const field of definition.fields) {
    const choice = mapping[field.name]
    const required =
      !field.nullable ||
      definition.business_key.includes(field.name) ||
      definition.label_field === field.name
    if (!choice?.source) {
      if (required) throw new Error(`Petakan field wajib: ${field.name}`)
      continue
    }
    columns.push({
      source_column: choice.source,
      target_column: field.name,
      target_type: field.type,
      nullable: field.nullable,
      pii_classification: field.pii_classification,
      is_business_key: definition.business_key.includes(field.name),
      is_primary_key: false,
      transformation_codes: [...choice.transforms],
      business_name: field.name,
      confidence: 1,
      reason: 'Mapping direview pengguna terhadap versi master approved.',
    })
  }
  if (new Set(columns.map((c) => c.source_column)).size !== columns.length)
    throw new Error('Setiap header sumber hanya dapat dipetakan sekali.')
  return columns
}
