import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('admin manages access registry and effective user assignments', async ({ page }) => {
  const state = await setup(page)
  const attributes: any[] = []
  const assignments: any[] = []
  const bundles: any[] = []
  const permissionGrants: any[] = []
  const policies: any[] = []
  const accessRequests: string[] = []
  const adminAssignments = [{
    id: 'assignment-admin',
    user_id: 'admin-id',
    attribute_id: 'attribute-finance',
    valid_from: '2026-09-27T00:00:00Z',
    valid_to: null,
    status: 'ACTIVE',
    revision: 1,
    revoked_at: null,
    attribute: {
      id: 'attribute-finance',
      kind: 'DEPARTMENT',
      code: 'FINANCE',
      label: 'Finance',
      parent_id: null,
      is_active: true,
      revision: 1,
      attribute_data: {},
    },
  }]
  await page.route('**/api/v1/users*', async (route) => {
    await route.fulfill({
      json: {
        status: 'success',
        data: [
          { id: 'viewer-id', username: 'viewer', role: 'VIEWER', is_active: true, row_scope: {} },
          { id: 'admin-id', username: 'admin', role: 'PLATFORM_ADMIN', is_active: true, row_scope: {} },
        ],
        meta: {},
        errors: [],
      },
    })
  })
  await page.route('**/api/v1/access/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const body = request.postData() ? request.postDataJSON() : undefined
    accessRequests.push(`${method} ${path}`)
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })
    if (path === '/access/attributes' && method === 'GET') return ok(attributes)
    if (path === '/access/attributes' && method === 'POST') {
      attributes.push({
        id: 'attribute-finance',
        ...body,
        code: body.code.toUpperCase(),
        is_active: true,
        revision: 1,
      })
      return ok(attributes[0])
    }
    if (path === '/access/permission-bundles' && method === 'GET') return ok(bundles)
    if (path === '/access/resources' && method === 'GET') {
      const url = new URL(request.url())
      const resourceType = url.searchParams.get('resource_type')
      const search = url.searchParams.get('search')?.toLowerCase() || ''
      const resources = resourceType === 'DATA_PRODUCT'
        ? [{ code: 'FINANCE_REPORT', name: 'Finance Report', status: 'ACTIVE' }]
        : [{ code: 'finance_source', name: 'Finance Source', status: 'DISCOVERED' }]
      return ok(resources.filter((resource) => resource.code.toLowerCase().includes(search)))
    }
    if (path === '/access/permission-bundles' && method === 'POST') {
      bundles.push({
        id: 'bundle-exporter',
        ...body,
        code: body.code.toUpperCase(),
        is_active: true,
        revision: 1,
      })
      return ok(bundles[0])
    }
    if (path === '/access/users/viewer-id/assignments' && method === 'GET') return ok(assignments)
    if (path === '/access/users/viewer-id/assignments' && method === 'POST') {
      assignments.push({
        id: 'assignment-finance',
        user_id: 'viewer-id',
        ...body,
        valid_from: body.valid_from || '2026-09-27T00:00:00Z',
        valid_to: body.valid_to || null,
        status: 'ACTIVE',
        revision: 1,
        revoked_at: null,
        attribute: attributes[0],
      })
      return ok(assignments[0])
    }
    if (path === '/access/users/viewer-id/permission-grants' && method === 'GET')
      return ok(permissionGrants)
    if (path === '/access/users/viewer-id/permission-grants' && method === 'POST') {
      permissionGrants.push({
        id: 'grant-exporter',
        user_id: 'viewer-id',
        ...body,
        valid_from: body.valid_from || '2026-09-27T00:00:00Z',
        valid_to: body.valid_to || null,
        status: 'ACTIVE',
        revision: 1,
        revoked_at: null,
        bundle: bundles[0],
      })
      return ok(permissionGrants[0])
    }
    if (path === '/access/users/viewer-id/effective')
      return ok({
        user: { id: 'viewer-id', username: 'viewer', role: 'VIEWER', is_active: true },
        as_of: '2026-09-27T00:00:00Z',
        actions: permissionGrants.some((item) => item.status === 'ACTIVE')
          ? ['DISCOVER', 'EXPORT', 'QUERY', 'READ']
          : ['DISCOVER', 'QUERY', 'READ'],
        dimensions: assignments.some((item) => item.status === 'ACTIVE')
          ? { DEPARTMENT: ['FINANCE'] }
          : {},
        assignments: assignments.filter((item) => item.status === 'ACTIVE'),
        permission_grants: permissionGrants.filter((item) => item.status === 'ACTIVE'),
      })
    if (path === '/access/users/admin-id/assignments' && method === 'GET') return ok(adminAssignments)
    if (path === '/access/users/admin-id/permission-grants' && method === 'GET') return ok([])
    if (path === '/access/users/admin-id/effective' && method === 'GET')
      return ok({
        user: { id: 'admin-id', username: 'admin', role: 'PLATFORM_ADMIN', is_active: true },
        as_of: '2026-09-27T00:00:00Z',
        actions: ['ADMIN', 'DISCOVER', 'QUERY', 'READ'],
        dimensions: { DEPARTMENT: ['FINANCE'] },
        assignments: adminAssignments,
        permission_grants: [],
      })
    if (path === '/access/assignments/assignment-finance/revoke' && method === 'POST') {
      assignments[0].status = 'REVOKED'
      assignments[0].revision++
      assignments[0].revoked_at = '2026-09-27T01:00:00Z'
      return ok(assignments[0])
    }
    if (path === '/access/permission-grants/grant-exporter/revoke' && method === 'POST') {
      permissionGrants[0].status = 'REVOKED'
      permissionGrants[0].revision++
      permissionGrants[0].revoked_at = '2026-09-27T01:00:00Z'
      return ok(permissionGrants[0])
    }
    if (path === '/access/policies' && method === 'GET') return ok(policies)
    if (path === '/access/policies' && method === 'POST') {
      policies.push({
        id: 'policy-finance',
        ...body,
        code: body.code.toUpperCase(),
        status: 'DRAFT',
        revision: 1,
        valid_from: '2026-09-27T00:00:00Z',
        valid_to: null,
        created_by: 'admin-id',
      })
      return ok(policies[0])
    }
    if (path === '/access/policies/policy-finance/bindings' && method === 'POST') {
      policies[0].revision++
      return ok({ id: 'binding-finance', policy_id: policies[0].id, ...body })
    }
    if (path === '/access/policies/policy-finance/submit' && method === 'POST') {
      policies[0].status = 'IN_REVIEW'
      policies[0].revision++
      return ok(policies[0])
    }
    if (path === '/access/evaluate' && method === 'POST')
      return ok({
        allowed: body.action !== 'EXPORT' || policies[0].export_allowed,
        reason_code:
          body.action === 'EXPORT' && !policies[0].export_allowed
            ? 'EXPORT_NOT_ALLOWED'
            : 'POLICY_MATCH',
        policy_ids: ['policy-finance'],
        policy_revisions: [{ id: 'policy-finance', revision: policies[0].revision }],
        row_scope: {},
        columns: {},
        export_allowed: body.action === 'EXPORT' && policies[0].export_allowed,
      })
    return route.fallback()
  })

  await page.goto('/admin')
  await login(page, 'admin')
  await page.getByLabel('Kode', { exact: true }).fill('finance')
  await page.getByLabel('Nama', { exact: true }).fill('Finance')
  await page.getByRole('button', { name: 'Tambah atribut' }).click()
  await expect(page.getByRole('cell', { name: 'FINANCE', exact: true })).toBeVisible()
  const bundleSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Permission bundle', exact: true, level: 2 }) })
  await bundleSection.getByLabel('Kode bundle').fill('report_exporter')
  await bundleSection.getByLabel('Nama bundle').fill('Report Exporter')
  await bundleSection.getByLabel('EXPORT', { exact: true }).check()
  await bundleSection.getByRole('button', { name: 'Tambah bundle' }).click()
  await expect(page.getByText(/REPORT_EXPORTER/)).toBeVisible()

  await page.getByRole('button', { name: 'Atur akses' }).first().click()
  await page.getByLabel('Atribut').selectOption('attribute-finance')
  await page.getByLabel('Catatan').fill('Finance 2026')
  await page.getByRole('button', { name: 'Berikan assignment' }).click()
  await expect(page.getByText('DEPARTMENT: FINANCE')).toBeVisible()
  await page.getByRole('combobox', { name: /^Bundle/ }).selectOption('bundle-exporter')
  await page.getByLabel('Alasan pemberian').fill('Ekspor laporan kuartal empat')
  await page.getByRole('button', { name: 'Berikan permission' }).click()
  await expect(page.getByText(/Role VIEWER.*EXPORT/)).toBeVisible()
  await page.getByRole('button', { name: 'Cabut permission' }).click()
  await expect(page.getByText('Permission bundle dicabut dan sesi pengguna direset.')).toBeVisible()

  const policySection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Access policy' }) })
  await policySection.getByLabel('Kode policy').fill('finance_query')
  await policySection.getByLabel('Nama policy').fill('Finance Query')
  await policySection.getByLabel('Cari kode resource').fill('unknown_code')
  await policySection.getByRole('button', { name: 'Cari resource' }).click()
  await expect(policySection.getByRole('combobox', { name: 'Resource', exact: true }).locator('option')).toHaveCount(1)
  await policySection.getByLabel('Cari kode resource').fill('FINANCE')
  await policySection.getByRole('button', { name: 'Cari resource' }).click()
  await policySection.getByRole('combobox', { name: 'Resource', exact: true }).selectOption('FINANCE_REPORT')
  await policySection.getByLabel('QUERY', { exact: true }).check()
  await policySection.getByLabel('EXPORT', { exact: true }).check()
  await policySection.getByLabel('Izinkan ekspor data').check()
  await policySection.getByRole('button', { name: 'Buat policy DRAFT' }).click()
  expect(policies[0].export_allowed).toBe(true)
  await expect(policySection.getByText(/FINANCE_QUERY.*DRAFT/)).toBeVisible()
  await policySection.getByRole('button', { name: 'Submit review' }).click()
  await expect(policySection.getByText(/FINANCE_QUERY.*IN_REVIEW/)).toBeVisible()
  await policySection.getByLabel('ID/kode resource evaluasi').fill('FINANCE_REPORT')
  await policySection.getByRole('button', { name: /Evaluasi viewer/ }).click()
  await expect(policySection.locator('pre')).toContainText('POLICY_MATCH')
  await policySection.getByLabel('Aksi evaluasi').selectOption('EXPORT')
  await expect(policySection.locator('pre')).toHaveCount(0)
  await policySection.getByRole('button', { name: /Evaluasi viewer/ }).click()
  await expect(policySection.getByText('Ekspor diizinkan')).toBeVisible()
  policies[0].export_allowed = false
  await policySection.getByRole('button', { name: /Evaluasi viewer/ }).click()
  await expect(policySection.getByText('Ditolak · EXPORT_NOT_ALLOWED')).toBeVisible()
  await expect(policySection.getByText('Ekspor tidak diizinkan')).toBeVisible()
  await page.getByRole('button', { name: 'Cabut', exact: true }).click()
  await expect(page.getByText('Assignment dicabut dan sesi pengguna direset.')).toBeVisible()
  await expect(policySection.locator('pre')).toHaveCount(0)

  await page.getByRole('button', { name: 'Atur akses' }).nth(1).click()
  await expect(page.getByText('Assignment milik sendiri harus diberikan atau dicabut oleh admin lain.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Berikan assignment' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cabut', exact: true })).toBeDisabled()

  expect(accessRequests).toContain('POST /access/attributes')
  expect(accessRequests).toContain('POST /access/users/viewer-id/assignments')
  expect(accessRequests).toContain('POST /access/permission-bundles')
  expect(accessRequests).toContain('POST /access/users/viewer-id/permission-grants')
  expect(accessRequests).toContain('POST /access/permission-grants/grant-exporter/revoke')
  expect(accessRequests).toContain('POST /access/policies')
  expect(accessRequests).toContain('GET /access/resources')
  expect(accessRequests).toContain('POST /access/policies/policy-finance/submit')
  expect(accessRequests).toContain('POST /access/evaluate')
  expect(accessRequests).toContain('POST /access/assignments/assignment-finance/revoke')
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
