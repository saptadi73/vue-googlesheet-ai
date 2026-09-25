import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('metadata conflict preserves edits, prevents retries, and reloads semantic version', async ({
  page,
}) => {
  const state = await setup(page)
  const product = {
    id: 'product-id',
    code: 'SALES',
    name: 'Sales',
    description: 'Old',
    version: 1,
    freshness_version: 2,
    columns: [],
    dimensions: [],
    metrics: [],
    allowed_roles: ['PLATFORM_ADMIN'],
    status: 'ACTIVE',
  }
  const patches: unknown[] = []
  await page.route('**/api/v1/data-products', (route) =>
    route.fulfill({ json: { status: 'success', data: [product], meta: {}, errors: [] } }),
  )
  await page.route('**/api/v1/semantic/data-products/product-id', (route) => {
    patches.push(route.request().postDataJSON())
    if (patches.length === 1) {
      product.version = 2
      product.name = 'Changed remotely'
      return route.fulfill({
        status: 409,
        json: {
          status: 'error',
          data: null,
          meta: {},
          errors: [{ code: 'PRODUCT_VERSION_CONFLICT', message: 'Muat ulang katalog' }],
        },
      })
    }
    Object.assign(product, { name: 'Final name', description: '', version: 3 })
    return route.fulfill({ json: { status: 'success', data: product, meta: {}, errors: [] } })
  })
  await page.goto('/dashboard')
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Produk data', exact: true }).selectOption('SALES')
  await page.getByText('Edit metadata bisnis produk', { exact: true }).click()
  await page.getByLabel('Nama bisnis produk', { exact: true }).fill('My edit')
  await page.getByRole('button', { name: 'Simpan metadata produk' }).click()
  await expect(page.getByLabel('Nama bisnis produk', { exact: true })).toHaveValue('My edit')
  await expect(page.getByRole('button', { name: 'Simpan metadata produk' })).toBeDisabled()
  expect(patches).toHaveLength(1)
  await page.getByRole('button', { name: 'Muat ulang metadata / batalkan edit lokal' }).click()
  await expect(page.getByLabel('Nama bisnis produk', { exact: true })).toHaveValue(
    'Changed remotely',
  )
  await page.getByLabel('Nama bisnis produk', { exact: true }).fill('Final name')
  await page.getByLabel('Deskripsi bisnis produk').fill('')
  await page.getByRole('button', { name: 'Simpan metadata produk' }).click()
  await expect(page.getByText('Metadata tersimpan.', { exact: false })).toBeVisible()
  expect(patches[1]).toEqual({ name: 'Final name', description: '', expected_version: 2 })
  expect(state.errors).toEqual([])
})
