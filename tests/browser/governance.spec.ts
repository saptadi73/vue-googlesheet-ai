import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('admin manages join metadata and AI task policy without enabling query joins or storing keys', async ({
  page,
}) => {
  const state = await setup(page)
  const products = [
    {
      id: 'sales-id',
      code: 'SALES',
      name: 'Penjualan',
      columns: [{ target_column: 'product_id' }],
      metrics: [],
      dimensions: [],
      allowed_roles: ['PLATFORM_ADMIN'],
      status: 'ACTIVE',
      version: 1,
      freshness_version: 1,
    },
    {
      id: 'product-id',
      code: 'PRODUCT',
      name: 'Produk',
      columns: [{ target_column: 'id' }],
      metrics: [],
      dimensions: [],
      allowed_roles: ['PLATFORM_ADMIN'],
      status: 'ACTIVE',
      version: 1,
      freshness_version: 1,
    },
  ]
  const relationships: any[] = []
  const policies: any[] = []
  const governanceRequests: Array<{ method: string; path: string; body: any }> = []
  const respond = (route: any, data: unknown) =>
    route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })

  await page.route('**/api/v1/semantic/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const body = request.postData() ? request.postDataJSON() : undefined
    governanceRequests.push({ method, path, body })
    if (path === '/semantic/data-products') return respond(route, products)
    if (path === '/semantic/join-relationships' && method === 'GET')
      return respond(route, relationships)
    if (path === '/semantic/join-relationships' && method === 'POST') {
      relationships.push({
        id: 'join-id',
        ...body,
        revision_no: 1,
        status: 'DRAFT',
        created_by: 'admin-id',
        approved_by: null,
      })
      return respond(route, relationships[0])
    }
    if (path === '/semantic/join-relationships/join-id/approve') {
      Object.assign(relationships[0], {
        status: 'APPROVED',
        revision_no: 2,
        approved_by: 'admin-id',
      })
      return respond(route, relationships[0])
    }
    throw new Error(`Unhandled semantic route ${method} ${path}`)
  })
  await page.route('**/api/v1/ai-task-policies**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const body = request.postData() ? request.postDataJSON() : undefined
    governanceRequests.push({ method, path, body })
    if (path === '/ai-task-policies' && method === 'GET') return respond(route, policies)
    if (path === '/ai-task-policies' && method === 'POST') {
      policies.push({
        id: 'policy-id',
        ...body,
        revision_no: 1,
        status: 'DRAFT',
        created_by: 'admin-id',
        approved_by: null,
        approved_at: null,
      })
      return respond(route, policies[0])
    }
    if (path === '/ai-task-policies/policy-id/approve') {
      Object.assign(policies[0], { status: 'APPROVED', revision_no: 2, approved_by: 'admin-id' })
      return respond(route, policies[0])
    }
    throw new Error(`Unhandled AI policy route ${method} ${path}`)
  })

  await page.goto('/governance')
  await login(page, 'admin')
  await page.getByLabel('Kode relationship').fill('sales_product')
  await page.getByLabel('Produk kiri').selectOption('SALES')
  await page.getByLabel('Produk kanan').selectOption('PRODUCT')
  await page.getByRole('button', { name: 'Simpan draft relationship' }).click()
  await expect(page.getByRole('heading', { name: /sales_product/ })).toBeVisible()
  await expect(
    page.getByText('Structured query masih single-product', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Setujui relationship' }).click()
  await expect(page.getByText('APPROVED', { exact: true }).first()).toBeVisible()

  await page.getByLabel('Kode policy').fill('etl_primary')
  await page.getByLabel('Purpose').selectOption('ETL_CONFIG')
  await expect(page.getByLabel('Prompt version')).toHaveValue('etl_configuration_v1.md')
  await page.getByLabel('Model aktif').fill('gpt-5.1')
  await page.getByLabel('Model yang diizinkan (satu per baris)').fill('gpt-5.1\ngpt-5-mini')
  await page.getByRole('button', { name: 'Simpan draft AI policy' }).click()
  await expect(page.getByRole('heading', { name: /etl_primary/ })).toBeVisible()
  await page.getByRole('button', { name: 'Setujui AI policy' }).click()
  await expect(page.getByText('APPROVED', { exact: true }).last()).toBeVisible()

  expect(
    governanceRequests.find(
      (request) => request.method === 'POST' && request.path === '/semantic/join-relationships',
    )?.body,
  ).toMatchObject({
    code: 'sales_product',
    left_product_code: 'SALES',
    left_column: 'product_id',
    right_product_code: 'PRODUCT',
    right_column: 'id',
    duplicate_policy: 'REJECT_AMBIGUOUS',
  })
  const policyBody = governanceRequests.find(
    (request) => request.method === 'POST' && request.path === '/ai-task-policies',
  )?.body
  expect(policyBody).toEqual({
    code: 'etl_primary',
    purpose: 'ETL_CONFIG',
    prompt_version: 'etl_configuration_v1.md',
    model: 'gpt-5.1',
    allowed_models: ['gpt-5.1', 'gpt-5-mini'],
  })
  expect(JSON.stringify(policyBody)).not.toContain('api_key')
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
