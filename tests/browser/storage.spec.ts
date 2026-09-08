import { test, expect, type Page } from '@playwright/test'
import { setup, login } from './fixtures'

async function storageSetup(page: Page) {
  const base = await setup(page)
  let storage = false,
    conflict = false,
    revision = 7
  const queries: URLSearchParams[] = []
  await page.route('**/api/v1/master-definitions/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    base.requests.push({
      path,
      method: request.method(),
      body: request.postData() ? request.postDataJSON() : undefined,
    })
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })
    const fail = (code: string) =>
      route.fulfill({
        status: 409,
        json: { status: 'error', data: null, meta: {}, errors: [{ code, message: code }] },
      })
    if (path.endsWith('/storage-plan'))
      return ok({
        target: 'trusted.master_test',
        master_version: 2,
        revision_no: revision,
        ddl: 'CREATE TABLE trusted.master_test (...)',
        schema_policy: 'IDENTICAL_OR_ADD_NULLABLE_ATTRIBUTES',
        execution_ready: false,
      })
    if (path.endsWith('/deploy-storage')) {
      if (conflict) {
        revision = 8
        return fail('MASTER_REVISION_CONFLICT')
      }
      storage = true
      return ok({
        target: 'trusted.master_test',
        master_version: 2,
        storage_ready: true,
        execution_ready: false,
      })
    }
    if (path.endsWith('/records')) {
      queries.push(url.searchParams)
      if (!storage) return fail('MASTER_STORAGE_STALE')
      const second = url.searchParams.get('offset') === '50'
      return ok({
        items: second
          ? []
          : [
              {
                _record_id: '11111111-1111-4111-8111-111111111111',
                code: '001',
                salary: '***',
                description: null,
              },
            ],
        has_more: !second,
        masked_fields: ['salary'],
      })
    }
    base.unexpected.push(path)
    return route.fulfill({ status: 404, json: {} })
  })
  return {
    ...base,
    queries,
    setConflict(value: boolean) {
      conflict = value
    },
    ready() {
      storage = true
    },
  }
}

test('reviewer deploys reviewed revision, preserves masking and leading zero, paginates applied filters', async ({
  page,
}) => {
  const state = await storageSetup(page)
  await page.goto('/masters/example/storage')
  await login(page, 'approver')
  await expect(page.getByRole('alert')).toContainText('MASTER_STORAGE_STALE')
  const deploy = page.getByRole('button', { name: 'Deploy storage', exact: true })
  await expect(deploy).toBeDisabled()
  await page.getByLabel('Saya telah meninjau rencana versi approved ini.').check()
  await page.getByLabel('Catatan deployment').fill('Schema telah ditinjau')
  await deploy.click()
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible()
  expect(state.requests.find((r) => r.path.endsWith('/deploy-storage'))?.body).toEqual({
    revision_no: 7,
    comment: 'Schema telah ditinjau',
  })
  await expect(
    page.getByText('Storage siap. Tidak ada data yang diimpor', { exact: false }),
  ).toBeVisible()
  await expect(page.getByText('Field disamarkan oleh backend:', { exact: false })).toContainText(
    'salary',
  )
  await page.getByLabel('Cari business key atau label').fill('001%_')
  await page.getByLabel('Hanya record aktif').uncheck()
  await page.getByRole('button', { name: 'Cari record', exact: true }).click()
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible()
  await page.getByLabel('Cari business key atau label').fill('belum diterapkan')
  await page.getByRole('button', { name: 'Record berikutnya' }).click()
  await expect(page.getByText('Tidak ada record untuk filter ini.', { exact: false })).toBeVisible()
  expect(state.queries.at(-1)?.get('search')).toBe('001%_')
  expect(state.queries.at(-1)?.get('active_only')).toBe('false')
  expect(state.queries.at(-1)?.get('offset')).toBe('50')
  await expect(page.getByRole('button', { name: 'Record berikutnya' })).toBeDisabled()
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('deployment conflict consumes plan and requires explicit reload without mutation retry', async ({
  page,
}) => {
  const state = await storageSetup(page)
  state.setConflict(true)
  await page.goto('/masters/example/storage')
  await login(page, 'approver')
  await expect(page.getByRole('alert')).toContainText('MASTER_STORAGE_STALE')
  await page.getByLabel('Saya telah meninjau rencana versi approved ini.').check()
  await page.getByRole('button', { name: 'Deploy storage', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('MASTER_REVISION_CONFLICT')
  await expect(page.getByRole('button', { name: 'Deploy storage', exact: true })).toHaveCount(0)
  expect(state.requests.filter((r) => r.path.endsWith('/deploy-storage'))).toHaveLength(1)
  await page.getByRole('button', { name: 'Muat ulang rencana' }).click()
  await expect(page.getByText('revisi registry 8', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deploy storage', exact: true })).toBeDisabled()
  expect(state.errors).toEqual([])
})

test('editor reads storage but cannot deploy; viewer cannot load metadata', async ({ page }) => {
  const state = await storageSetup(page)
  state.ready()
  await page.goto('/masters/example/storage')
  await login(page)
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deploy storage', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await expect(page).toHaveURL(/\/workspace$/)
  await page.goto('/masters/example/storage')
  const count = state.requests.filter((r) => r.path.startsWith('/master-definitions')).length
  await login(page, 'viewer')
  await expect(page.getByRole('cell', { name: '001', exact: true })).toHaveCount(0)
  expect(state.requests.filter((r) => r.path.startsWith('/master-definitions'))).toHaveLength(count)
  expect(state.errors).toEqual([])
})
