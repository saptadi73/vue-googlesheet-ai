import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('dashboard sends approved join relationship and qualified secondary fields', async ({ page }) => {
  const state = await setup(page)
  const sales = {
    ...state.product,
    columns: [
      { target_column: 'product_id', target_type: 'uuid', pii_classification: 'NONE' },
      { target_column: 'net_amount', target_type: 'numeric', pii_classification: 'NONE' },
    ],
  }
  const product = {
    id: 'product-catalog-id',
    code: 'PRODUCT',
    name: 'Produk',
    description: 'Master produk',
    columns: [
      { target_column: 'id', target_type: 'uuid', pii_classification: 'NONE' },
      { target_column: 'category', target_type: 'text', pii_classification: 'NONE' },
    ],
    dimensions: ['category'],
    metrics: [],
    allowed_roles: ['VIEWER'],
    status: 'ACTIVE',
    version: 1,
    freshness_version: 1,
  }
  let queryBody: any
  await page.route('**/api/v1/data-products', (route) =>
    route.fulfill({ json: { status: 'success', data: [sales, product], meta: {}, errors: [] } }),
  )
  await page.route('**/api/v1/semantic/join-relationships', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: [
          {
            id: 'join-id',
            code: 'sales_product',
            left_product_code: 'SALES',
            left_column: 'product_id',
            right_product_code: 'PRODUCT',
            right_column: 'id',
            cardinality: 'MANY_TO_ONE',
            join_type: 'LEFT',
            duplicate_policy: 'REJECT_AMBIGUOUS',
            revision_no: 2,
            status: 'APPROVED',
            created_by: 'admin',
            approved_by: 'reviewer',
          },
        ],
        meta: {},
        errors: [],
      },
    }),
  )
  await page.route('**/api/v1/data-products/SALES/query', async (route) => {
    queryBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        status: 'success',
        data: [{ 'PRODUCT.category': 'Food', net_sales: 100 }],
        meta: { joined_products: ['PRODUCT'], join_relationships: ['sales_product'] },
        errors: [],
      },
    })
  })

  await page.goto('/dashboard')
  await login(page, 'viewer')
  await page.locator('#data-product').selectOption('SALES')
  await page.getByText('Gabungkan produk melalui relationship approved').click()
  await page.getByLabel(/sales_product:/).check()
  await page.getByLabel('PRODUCT · category').check()
  await page.getByLabel('Penjualan bersih', { exact: true }).check()
  await page.getByRole('button', { name: 'Jalankan query' }).click()

  expect(queryBody).toMatchObject({
    join_relationships: ['sales_product'],
    dimensions: ['PRODUCT.category'],
    metrics: ['net_sales'],
  })
  await expect(page.getByRole('cell', { name: 'Food' })).toBeVisible()
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('dashboard hides HIDDEN fields and excludes masked metrics from query choices', async ({ page }) => {
  const state = await setup(page)
  const restrictedProduct = {
    ...state.product,
    columns: [
      { target_column: 'public_field', target_type: 'text', pii_classification: 'NONE' },
      {
        target_column: 'masked_field',
        target_type: 'text',
        pii_classification: 'LOW',
        access_visibility: 'MASKED',
      },
      {
        target_column: 'hidden_field',
        target_type: 'numeric',
        pii_classification: 'LOW',
        access_visibility: 'HIDDEN',
      },
    ],
    dimensions: ['public_field', 'masked_field', 'hidden_field'],
    metrics: [
      { code: 'public_metric', label: 'Metrik publik', column: 'public_field' },
      { code: 'masked_metric', label: 'Metrik masked', column: 'masked_field' },
      { code: 'hidden_metric', label: 'Metrik hidden', column: 'hidden_field' },
    ],
  }
  await page.route('**/api/v1/data-products', (route) =>
    route.fulfill({ json: { status: 'success', data: [restrictedProduct], meta: {}, errors: [] } }),
  )

  await page.goto('/dashboard')
  await login(page, 'viewer')
  await page.locator('#data-product').selectOption('SALES')

  await expect(page.getByRole('checkbox', { name: 'public_field' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'masked_field [MASKED]' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'hidden_field' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Metrik publik' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Metrik masked' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Metrik hidden' })).toHaveCount(0)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
