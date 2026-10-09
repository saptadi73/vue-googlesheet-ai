import type { Column, Metric } from './etl'
export interface Product {
  id: string
  source_sheet_id?: string
  code: string
  name: string
  description: string
  columns: Column[]
  dimensions: string[]
  metrics: Metric[]
  allowed_roles: string[]
  status: string
  version: number
  freshness_version: number
}
export interface ProductInventory extends Product {
  source_id: string
  source_name: string
  source_code: string
  spreadsheet_id: string
  spreadsheet_url: string
  sheet_name: string
  sheet_id: number
  source_enabled: boolean
  source_present: boolean
  database_schema: string
  database_table: string
  semantic_view: string
  configuration_id: string
  configuration_version: number
  configuration_revision: number
  configuration_status: string
}
export interface QueryPlan {
  join_relationships: string[]
  metrics: string[]
  dimensions: string[]
  filters: { field: string; operator: string; value: unknown }[]
  sort: { field: string; direction: string }[]
  time_grain: string
  limit: number
  offset: number
  visualization?: VisualizationSpec | null
}
export type VisualizationType =
  'table' | 'kpi' | 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'combo' | 'scatter' | 'heatmap'
export interface VisualizationSpec {
  type: VisualizationType
  title: string
  x_field: string | null
  y_field: string | null
  series: Array<{ field: string; type: 'bar' | 'line' | 'area'; axis: 'left' | 'right' }>
}
export interface SavedQuery {
  id: string
  code: string
  data_product_code: string
  status: string
  plan: QueryPlan
  examples: string[]
  allowed_roles: string[]
}
export type Row = Record<string, unknown>
export function emptyPlan(): QueryPlan {
  return {
    join_relationships: [],
    metrics: [],
    dimensions: [],
    filters: [],
    sort: [],
    time_grain: 'none',
    limit: 100,
    offset: 0,
    visualization: null,
  }
}
