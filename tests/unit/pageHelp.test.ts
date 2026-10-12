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
  it('explains serial date conversion and schema migration separately from review approval', () => {
    for (const path of ['/workspace', '/configurations/config-id/review']) {
      const help = getPageHelp(path)
      const content = [...help.steps, ...(help.notes || [])].join(' ')
      expect(content).toContain('start_date/end_date')
      expect(content).toContain('parse_date_id')
      expect(content).toContain('serial')
      expect(content).toContain('Pola tanggal')
      expect(content).toContain('nama tabel')
      expect(content).toContain('DEPLOY')
      expect(content).toContain('/guide#review-ulang-tanggal')
    }
    const review = getPageHelp('/configurations/config-id/review').notes?.join(' ')
    expect(review).toContain('TYPE_OR_NULL_ERROR')
    expect(review).toContain('Preview perubahan schema')
    expect(review).toContain('SCHEMA_MIGRATION_STALE')
    expect(review).toContain('Worker mendukung nullable baru')
    expect(review).toContain('Dry-run lulus tidak menjamin')
  })
  it('explains initial source approval and owner-managed sync separately from legacy review', () => {
    const review = getPageHelp('/configurations/config-id/review').steps.join(' ')
    expect(review).toContain('owner workflow')
    expect(review).toContain('release kedua tidak diperlukan')
    expect(review).toContain('Konfigurasi legacy')
    expect(review).not.toContain('approval gabungan')
    for (const route of ['/sources', '/workspace']) {
      const help = getPageHelp(route)
      const content = [...help.steps, ...(help.notes || [])].join(' ')
      expect(content).toContain('Sync manual')
      expect(content).toContain('berikon mata')
      expect(content).toContain('baris asli')
      expect(content).toContain('NEEDS_INPUT')
    }
    expect(getPageHelp('/workspace').steps.join(' ')).toContain('Approval awal sumber')
  })
  it('explains source tracking and safe unlink/restore flow', () => {
    const help = getPageHelp('/sources')
    expect(help.title).toContain('Sumber')
    expect(help.steps.join(' ')).toContain('pagination')
    expect(help.notes?.join(' ')).toContain('dua konfirmasi')
  })

  it('separates initial source approval from owner-managed ETL and legacy release review', () => {
    const batch = getPageHelp('/import-reviews').steps.join(' ')
    expect(batch).toContain('approval awal sumber')
    expect(batch).toContain('owner-managed')
    expect(batch).toContain('legacy')

    const releases = getPageHelp('/release-approvals')
    const content = [...releases.steps, ...(releases.notes || [])].join(' ')
    expect(content).toContain('Approval awal sumber/tab')
    expect(content).toContain('tidak memerlukan approval konfigurasi/rilis berulang')
    expect(content).toContain('konfigurasi legacy')
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
