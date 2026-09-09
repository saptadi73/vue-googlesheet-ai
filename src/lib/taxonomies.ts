import type { ETL } from './etl'

export function validateTaxonomyConfiguration(configuration: ETL) {
  for (const column of configuration.columns) {
    if (column.taxonomy_id) {
      if (
        !['text', 'varchar'].includes(column.target_type) ||
        !Number.isInteger(column.taxonomy_version) ||
        (column.taxonomy_version ?? 0) < 1
      )
        throw new Error(
          `Taxonomy ${column.source_column} memerlukan tipe text/varchar dan versi positif.`,
        )
    } else if (column.taxonomy_version != null || column.taxonomy_required) {
      throw new Error(
        `Referensi taxonomy ${column.source_column} tidak lengkap. Hapus referensi atau gunakan binding approved.`,
      )
    }
  }
  for (const rule of configuration.data_quality_rules) {
    if (rule.rule !== 'in_taxonomy') continue
    const column = configuration.columns.find((item) => item.target_column === rule.column)
    if (!column?.taxonomy_id || !column.taxonomy_version)
      throw new Error(`Rule in_taxonomy pada ${rule.column} memerlukan mapping taxonomy.`)
    if (rule.value != null || rule.action_on_fail === 'WARN')
      throw new Error('Rule in_taxonomy wajib value null dan tidak menerima action WARN.')
  }
}

export interface TaxonomyMetadata {
  fingerprint?: string
  snapshot_hash?: string
  created_by?: string
  approved_by?: string | null
  approved_at?: string | null
}
export interface Taxonomy extends TaxonomyMetadata {
  id: string
  code: string
  name: string
  version: number
  status: 'DRAFT' | 'APPROVED'
  is_active: boolean
  created_by: string
}

export interface TaxonomyTerm extends TaxonomyMetadata {
  id: string
  taxonomy_id: string
  code: string
  label: string
  parent_id: string | null
  aliases: string[]
  is_active: boolean
}

export interface TaxonomyColumnBinding extends TaxonomyMetadata {
  id: string
  source_sheet_id: string
  source_column: string
  taxonomy_id: string
  taxonomy_version: number
  required: boolean
  normalization: string
  revision_no: number
  status: 'DRAFT' | 'APPROVED' | 'REJECTED'
  created_by: string
  approved_by: string | null
  approved_at: string | null
}

export type VersionTerm = Pick<
  TaxonomyTerm,
  'id' | 'code' | 'label' | 'parent_id' | 'aliases' | 'is_active'
>
export interface TaxonomyVersion extends TaxonomyMetadata {
  id: string
  taxonomy_id: string
  version: number
  base_version: number
  revision_no: number
  status: string
  definition_json: { terms: VersionTerm[] }
}
export interface TaxonomyResolution {
  status: 'EXACT' | 'CANDIDATE' | 'AMBIGUOUS' | 'NOT_FOUND'
  term?: TaxonomyTerm
  candidates?: TaxonomyTerm[]
  requires_question: boolean
}
export interface TaxonomyRecommendations {
  taxonomy_id: string
  taxonomy_version: number
  recommendations: Array<{
    value: string
    candidates: Array<{ term: TaxonomyTerm; confidence: number }>
    requires_confirmation: boolean
  }>
}

export function versionTerms(terms: VersionTerm[]): VersionTerm[] {
  return terms.map(({ id, code, label, parent_id, aliases, is_active }) => ({
    id,
    code,
    label,
    parent_id,
    aliases: [...aliases],
    is_active,
  }))
}

export function validateVersionTerms(terms: VersionTerm[], original: VersionTerm[]) {
  const byId = new Map(terms.map((term) => [term.id, term]))
  const originalById = new Map(original.map((term) => [term.id, term]))
  if (byId.size !== terms.length || new Set(terms.map((term) => term.code)).size !== terms.length)
    throw new Error('UUID dan kode term harus unik.')
  for (const term of terms) {
    if (!term.code.trim() || !term.label.trim()) throw new Error('Isi kode dan label setiap term.')
    const existing = originalById.get(term.id)
    if (existing && existing.code !== term.code)
      throw new Error('Kode term tersimpan tidak dapat diganti.')
    const visited = new Set([term.id])
    let parentId = term.parent_id
    while (parentId) {
      if (visited.has(parentId)) throw new Error('Hierarki term tidak boleh memiliki siklus.')
      visited.add(parentId)
      const parent = byId.get(parentId)
      if (!parent) throw new Error('Semua parent harus disertakan dalam daftar term.')
      if (term.is_active && !parent.is_active) throw new Error('Ancestor term aktif harus aktif.')
      parentId = parent.parent_id
    }
  }
}

export function diffVersionTerms(before: VersionTerm[], after: VersionTerm[]) {
  const old = new Map(before.map((term) => [term.id, term]))
  const next = new Map(after.map((term) => [term.id, term]))
  return [...new Set([...old.keys(), ...next.keys()])].flatMap((id) => {
    const previous = old.get(id),
      current = next.get(id)
    if (JSON.stringify(previous) === JSON.stringify(current)) return []
    return [
      {
        id,
        operation: !previous ? 'ADD' : !current ? 'REMOVE / DEACTIVATE' : 'CHANGE',
        before: previous ?? null,
        after: current ?? null,
      },
    ]
  })
}
