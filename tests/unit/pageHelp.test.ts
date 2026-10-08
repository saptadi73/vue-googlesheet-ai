import { describe, expect, it } from 'vitest'
import { getPageHelp } from '../../src/lib/pageHelp'

const routes = [
  '/login',
  '/guide',
  '/',
  '/dashboard',
  '/chat',
  '/workspace',
  '/sources',
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
  it('explains source tracking and safe unlink/restore flow', () => {
    const help = getPageHelp('/sources')
    expect(help.title).toContain('Sumber')
    expect(help.steps.join(' ')).toContain('pagination')
    expect(help.notes?.join(' ')).toContain('dua konfirmasi')
  })

  it('points ETL reviewers to guidance for each wizard step', () => {
    expect(getPageHelp('/configurations/config-id/review').notes?.join(' ')).toContain(
      'ikon bantuan di samping setiap tahap wizard',
    )
  })

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

  it('shows concrete examples on the relevant pages', () => {
    expect(getPageHelp('/taxonomies').examples).toContainEqual({
      label: 'Kode · nama taxonomy',
      value: 'jenis_biaya · Jenis Biaya',
    })
    expect(
      getPageHelp('/admin').examples?.find((item) => item.label === 'JURISDICTION')?.value,
    ).toBe('jatim · Jawa Timur')
    expect(
      getPageHelp('/workspace').examples?.some((item) => item.label === 'Purpose · sensitivitas'),
    ).toBe(true)
    expect(
      getPageHelp('/masters/new').examples?.some((item) => item.label === 'Business key'),
    ).toBe(true)
    expect(
      getPageHelp('/sources/source-id/sheets/sheet-id/column-bindings').examples,
    ).toContainEqual({ label: 'Field master', value: 'product_code · berisi SKU-001 dan nilainya unik' })
  })
})
