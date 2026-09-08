import type { Column, Metric } from './etl'
export interface Product {
  id: string
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
export interface QueryPlan {
  metrics: string[]
  dimensions: string[]
  filters: { field: string; operator: string; value: unknown }[]
  sort: { field: string; direction: string }[]
  time_grain: string
  limit: number
  offset: number
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
    metrics: [],
    dimensions: [],
    filters: [],
    sort: [],
    time_grain: 'none',
    limit: 100,
    offset: 0,
  }
}
