export type JoinCardinality = 'ONE_TO_ONE' | 'MANY_TO_ONE' | 'ONE_TO_MANY'
export type JoinType = 'LEFT' | 'INNER'
export type JoinDuplicatePolicy = 'REJECT_AMBIGUOUS' | 'AGGREGATE_RIGHT'

export interface JoinRelationship {
  id: string
  code: string
  left_product_code: string
  left_column: string
  right_product_code: string
  right_column: string
  cardinality: JoinCardinality
  join_type: JoinType
  duplicate_policy: JoinDuplicatePolicy
  revision_no: number
  status: 'DRAFT' | 'APPROVED' | 'REJECTED'
  created_by: string
  approved_by: string | null
}

export type AIPurpose = 'ETL_CONFIG' | 'TAXONOMY_RECOMMEND' | 'NL2SQL'

export interface AITaskPolicy {
  id: string
  code: string
  purpose: AIPurpose
  prompt_version: string
  model: string
  allowed_models: string[]
  data_product_code: string | null
  max_context_chars: number
  daily_budget_usd: number | null
  fallback_model: string | null
  revision_no: number
  status: 'DRAFT' | 'APPROVED' | 'REJECTED'
  created_by: string
  approved_by: string | null
  approved_at: string | null
}

export const promptByPurpose: Record<AIPurpose, string> = {
  ETL_CONFIG: 'etl_configuration_v1.md',
  TAXONOMY_RECOMMEND: 'taxonomy_recommend_v1.md',
  NL2SQL: 'nl2sql_v1.md',
}
