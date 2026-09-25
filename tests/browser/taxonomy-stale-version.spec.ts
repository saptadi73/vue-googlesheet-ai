import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('stale base version is readable but cannot be saved or published', async ({ page }) => {
  const state = await setup(page)
  const term = {
    id: 'term',
    code: 'tea',
    label: 'Tea',
    parent_id: null,
    aliases: [],
    is_active: true,
  }
  const version = {
    id: 'old-draft',
    taxonomy_id: 'taxonomy',
    version: 3,
    base_version: 2,
    revision_no: 7,
    status: 'DRAFT',
    definition_json: { terms: [term] },
  }
  const mutations: string[] = []
  await page.route('**/api/v1/taxonomies**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') mutations.push(path)
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (path.endsWith('/taxonomies'))
      return ok([
        {
          id: 'taxonomy',
          code: 'beverages',
          name: 'Beverages',
          version: 4,
          status: 'APPROVED',
          is_active: true,
        },
      ])
    if (path.endsWith('/terms')) return ok([term])
    if (path.endsWith('/versions')) return ok({ items: [version], has_more: false })
    if (path.endsWith('/old-draft')) return ok(version)
    throw new Error(path)
  })
  await page.goto('/taxonomies')
  await login(page, 'admin')
  await page.getByRole('button', { name: 'beverages / v4 / APPROVED' }).click()
  await page.getByRole('button', { name: 'Muat riwayat versi' }).click()
  await page.getByRole('button', { name: 'Versi 3 / DRAFT / revisi 7', exact: true }).click()
  await expect(
    page.getByText('Draft memakai versi dasar 2, sedangkan versi aktif 4.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('Saya telah meninjau snapshot draft ini')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Publikasikan versi taxonomy' })).toBeDisabled()
  await page.getByLabel('Label term', { exact: true }).fill('Local edit retained')
  await expect(page.getByRole('button', { name: 'Simpan seluruh term draft' })).toBeDisabled()
  await expect(page.getByLabel('Label term', { exact: true })).toHaveValue('Local edit retained')
  expect(mutations).toEqual([])
  expect(state.errors).toEqual([])
})
