import { describe, expect, it } from 'vitest'
import { getPageHelp } from '../../src/lib/pageHelp'

const routes = [
  '/login',
  '/guide',
  '/',
  '/dashboard',
  '/chat',
  '/workspace',
  '/configurations/config-id/review',
  '/masters',
  '/masters/new',
  '/masters/master-id',
  '/masters/master-id/storage',
  '/sources/source-id/sheets/sheet-id/master-binding',
  '/sources/source-id/sheets/sheet-id/column-bindings',
  '/sources/source-id/sheets/sheet-id/taxonomy-bindings',
  '/taxonomies',
  '/governance',
  '/import-reviews',
  '/import-reviews/review-id',
  '/jobs',
  '/quality',
  '/admin',
  '/admin/users',
  '/register',
  '/admin/users/new',
  '/account',
  '/access-requests',
]

describe('page help registry', () => {
  it.each(routes)('provides specific guidance for %s', (path) => {
    const help = getPageHelp(path)
    expect(help.title).not.toBe('Bantuan halaman')
    expect(help.purpose.length).toBeGreaterThan(20)
    expect(help.steps.length).toBeGreaterThanOrEqual(3)
    expect(help.steps.every((step) => step.length > 15)).toBe(true)
  })

  it('provides safe fallback guidance for a future page', () => {
    const help = getPageHelp('/future-page')
    expect(help.title).toBe('Bantuan halaman')
    expect(help.steps).toHaveLength(4)
  })
})