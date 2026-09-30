import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('admin manages join metadata and AI task policy without storing keys', async ({
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
  const policyVersions: any[] = []
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
  await page.route('**/api/v1/sources', (route) =>
    respond(route, [
      {
        id: 'source-id',
        source_code: 'sales_source',
        name: 'Sumber penjualan',
        status: 'ACTIVE',
        paused: false,
      },
    ]),
  )
  await page.route('**/api/v1/taxonomies', (route) =>
    respond(route, [
      {
        id: 'taxonomy-id',
        code: 'regions',
        name: 'Wilayah',
        status: 'APPROVED',
        is_active: true,
      },
    ]),
  )
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
      policyVersions.unshift({
        id: 'policy-version-1',
        policy_id: 'policy-id',
        revision_no: 1,
        action: 'CREATED',
        snapshot_json: { ...body, revision_no: 1, status: 'DRAFT' },
        actor_user_id: 'admin-id',
        created_at: '2026-09-30T10:00:00Z',
      })
      return respond(route, policies[0])
    }
    if (path === '/ai-task-policies/policy-id/versions' && method === 'GET')
      return respond(route, policyVersions)
    if (path === '/ai-task-policies/policy-id' && method === 'PATCH') {
      Object.assign(policies[0], body, {
        revision_no: policies[0].revision_no + 1,
        approved_by: null,
        approved_at: null,
      })
      policyVersions.unshift({
        id: 'policy-version-2',
        policy_id: 'policy-id',
        revision_no: 2,
        action: 'UPDATED',
        snapshot_json: { ...policies[0] },
        actor_user_id: 'admin-id',
        created_at: '2026-09-30T10:01:00Z',
      })
      return respond(route, policies[0])
    }
    if (path === '/ai-task-policies/policy-id/approve') {
      Object.assign(policies[0], {
        status: 'APPROVED',
        revision_no: policies[0].revision_no + 1,
        approved_by: 'admin-id',
      })
      policyVersions.unshift({
        id: 'policy-version-3',
        policy_id: 'policy-id',
        revision_no: 3,
        action: 'APPROVED',
        snapshot_json: { ...policies[0] },
        actor_user_id: 'admin-id',
        created_at: '2026-09-30T10:02:00Z',
      })
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
  await expect(page.getByText('structured query multi-product', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Setujui relationship' }).click()
  await expect(page.getByText('APPROVED', { exact: true }).first()).toBeVisible()

  await page.getByLabel('Kode policy').fill('etl_primary')
  await page.getByLabel('Purpose').selectOption('NL2SQL')
  await expect(page.getByLabel('Prompt version')).toHaveValue('nl2sql_v1.md')
  await page.getByLabel('Data product').selectOption('SALES')
  await page.getByLabel('Model aktif').fill('gpt-5.1')
  await page.getByLabel('Fallback model').fill('gpt-5-mini')
  await page.getByLabel('Batas konteks (karakter)').fill('50000')
  await page.getByLabel('Budget harian policy (USD)').fill('2.5')
  await page.getByLabel('Model yang diizinkan (satu per baris)').fill('gpt-5.1\ngpt-5-mini')
  await expect(page.getByText(/Semua model dalam daftar harus ada pada allowlist server/)).toBeVisible()
  await page.getByRole('button', { name: 'Simpan draft AI policy' }).click()
  await expect(page.getByRole('heading', { name: /etl_primary/ })).toBeVisible()
  await page.getByRole('button', { name: 'Edit AI policy' }).click()
  await page.getByLabel('Model aktif').fill('gpt-5-mini')
  await page.getByLabel('Fallback model').fill('gpt-5.1')
  await page.getByRole('button', { name: 'Simpan draft AI policy' }).click()
  await expect(page.getByText(/model gpt-5-mini · revisi 2/)).toBeVisible()
  await page.getByRole('button', { name: 'Setujui AI policy' }).click()
  await expect(page.getByText('APPROVED', { exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Lihat riwayat versi' }).click()
  await expect(page.getByText(/Revisi 3 · APPROVED · APPROVED · gpt-5-mini/)).toBeVisible()
  await expect(page.getByText(/Revisi 2 · UPDATED · DRAFT · gpt-5-mini/)).toBeVisible()
  await expect(page.getByText(/Revisi 1 · CREATED · DRAFT · gpt-5.1/)).toBeVisible()

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
    purpose: 'NL2SQL',
    prompt_version: 'nl2sql_v1.md',
    model: 'gpt-5.1',
    allowed_models: ['gpt-5.1', 'gpt-5-mini'],
    data_product_code: 'SALES',
    data_source_id: null,
    taxonomy_id: null,
    max_context_chars: 50000,
    daily_budget_usd: 2.5,
    fallback_model: 'gpt-5-mini',
  })
  expect(JSON.stringify(policyBody)).not.toContain('api_key')
  expect(
    governanceRequests.find(
      (request) => request.method === 'PATCH' && request.path === '/ai-task-policies/policy-id',
    )?.body,
  ).toEqual({
    code: 'etl_primary',
    purpose: 'NL2SQL',
    prompt_version: 'nl2sql_v1.md',
    model: 'gpt-5-mini',
    allowed_models: ['gpt-5.1', 'gpt-5-mini'],
    data_product_code: 'SALES',
    data_source_id: null,
    taxonomy_id: null,
    max_context_chars: 50000,
    daily_budget_usd: 2.5,
    fallback_model: 'gpt-5.1',
    revision_no: 1,
  })
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('AI task policies can be scoped to a source or approved taxonomy', async ({ page }) => {
  await setup(page)
  const requests: any[] = []
  const ok = (route: any, data: unknown) =>
    route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })
  const source = {
    id: 'source-id',
    source_code: 'sales_source',
    name: 'Sumber penjualan',
    status: 'ACTIVE',
    paused: false,
  }
  const taxonomy = {
    id: 'taxonomy-id',
    code: 'regions',
    name: 'Wilayah',
    status: 'APPROVED',
    is_active: true,
  }
  const unavailableTaxonomy = {
    id: 'draft-taxonomy-id',
    code: 'draft_regions',
    name: 'Draft regions',
    status: 'DRAFT',
    is_active: true,
  }
  await page.route('**/api/v1/semantic/data-products', (route) => ok(route, []))
  await page.route('**/api/v1/semantic/join-relationships', (route) => ok(route, []))
  await page.route('**/api/v1/sources', (route) => ok(route, [source]))
  await page.route('**/api/v1/taxonomies', (route) => ok(route, [taxonomy, unavailableTaxonomy]))
  await page.route('**/api/v1/ai-task-policies**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (request.method() === 'GET') return ok(route, [])
    const body = request.postDataJSON()
    requests.push({ path, body })
    return ok(route, {
      id: `policy-${requests.length}`,
      ...body,
      revision_no: 1,
      status: 'DRAFT',
      created_by: 'admin-id',
      approved_by: null,
      approved_at: null,
    })
  })

  await page.goto('/governance')
  await login(page, 'admin')
  await page.getByLabel('Kode policy').fill('sales_etl_policy')
  await page.getByLabel('Source dataset').selectOption('source-id')
  await page.getByLabel('Model aktif').fill('gpt-5-mini')
  await page.getByLabel('Model yang diizinkan (satu per baris)').fill('gpt-5-mini')
  await page.getByRole('button', { name: 'Simpan draft AI policy' }).click()

  await page.getByLabel('Kode policy').fill('region_taxonomy_policy')
  await page.getByLabel('Purpose').selectOption('TAXONOMY_RECOMMEND')
  await expect(page.locator('#policy-taxonomy')).not.toContainText('draft_regions')
  await page.locator('#policy-taxonomy').selectOption('taxonomy-id')
  await page.getByLabel('Model aktif').fill('gpt-5-mini')
  await page.getByLabel('Model yang diizinkan (satu per baris)').fill('gpt-5-mini')
  await page.getByRole('button', { name: 'Simpan draft AI policy' }).click()

  expect(requests.map((request) => request.body)).toMatchObject([
    {
      purpose: 'ETL_CONFIG',
      data_product_code: null,
      data_source_id: 'source-id',
      taxonomy_id: null,
    },
    {
      purpose: 'TAXONOMY_RECOMMEND',
      data_product_code: null,
      data_source_id: null,
      taxonomy_id: 'taxonomy-id',
    },
  ])
})
