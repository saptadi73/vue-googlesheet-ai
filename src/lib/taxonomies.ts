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
