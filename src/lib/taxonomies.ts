export interface Taxonomy {
  id: string
  code: string
  name: string
  version: number
  status: 'DRAFT' | 'APPROVED'
  is_active: boolean
  created_by: string
}

export interface TaxonomyTerm {
  id: string
  taxonomy_id: string
  code: string
  label: string
  parent_id: string | null
  aliases: string[]
  is_active: boolean
}

export interface TaxonomyColumnBinding {
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
