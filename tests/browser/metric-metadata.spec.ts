import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('metric metadata saves a scoped versioned patch, displays units and clears metadata', async ({
  page,
}) => {
  const state = await setup(page)
  const product = {
    id: 'product-id',
    code: 'SALES',
    name: 'Sales',
    description: '',
    version: 1,
    freshness_version: 2,
    columns: [],
    dimensions: [],
    allowed_roles: ['PLATFORM_ADMIN'],
    status: 'ACTIVE',
    metrics: [
      {
        code: 'sales',
        label: 'Sales total',
        column: 'amount',
        aggregation: 'sum',
        unit: null as string | null,
        synonyms: [] as string[],
      },
    ],
  }
  const patches: any[] = []
  await page.route('**/api/v1/data-products', (route) =>
    route.fulfill({ json: { status: 'success', data: [product], errors: [], meta: {} } }),
  )
  await page.route('**/api/v1/semantic/data-products/product-id', (route) => {
    const body = route.request().postDataJSON()
    patches.push(body)
    Object.assign(product.metrics[0]!, body.metric_metadata[0])
    product.version++
    return route.fulfill({ json: { status: 'success', data: product, errors: [], meta: {} } })
  })
  await page.goto('/dashboard')
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Produk data', exact: true }).selectOption('SALES')
  await page.getByText('Edit metadata bisnis produk', { exact: true }).click()
  const unit = page.getByLabel('Unit sales', { exact: true })
  const synonyms = page.getByLabel('Sinonim sales (satu per baris)', { exact: true })
  await unit.fill('IDR')
  await synonyms.fill('Revenue\n revenue ')
  await page.getByRole('button', { name: 'Simpan metadata produk' }).click()
  await expect(page.getByRole('alert')).toContainText('sinonim unik')
  expect(patches).toHaveLength(0)
  await synonyms.fill('Revenue\nNet sales')
  await page.getByRole('button', { name: 'Simpan metadata produk' }).click()
  await expect(
    page.getByText('sales: unit IDR; sinonim Revenue, Net sales;', { exact: false }),
  ).toBeVisible()
  expect(patches[0]).toEqual({
    name: 'Sales',
    description: '',
    expected_version: 1,
    metric_metadata: [{ code: 'sales', unit: 'IDR', synonyms: ['Revenue', 'Net sales'] }],
  })
  await unit.fill('')
  await synonyms.fill('')
  await page.getByRole('button', { name: 'Simpan metadata produk' }).click()
  await expect(page.getByRole('button', { name: 'Simpan metadata produk' })).toBeDisabled()
  expect(patches[1].metric_metadata).toEqual([{ code: 'sales', unit: null, synonyms: [] }])
  expect(patches[1].expected_version).toBe(2)
  expect(state.errors).toEqual([])
})

test('viewer cannot edit metric metadata', async ({ page }) => {
  await setup(page)
  await page.goto('/dashboard')
  await login(page, 'viewer')
  await page.getByRole('combobox', { name: 'Produk data', exact: true }).selectOption('SALES')
  await expect(page.getByText('Edit metadata bisnis produk', { exact: true })).toHaveCount(0)
})
