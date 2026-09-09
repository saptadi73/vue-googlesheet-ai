import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('period closure preview is opt-in, approved mode is locked, stale apply requires new review', async ({ page }) => {
  const state = await setup(page)
  let revision = 1
  let status = 'READY_FOR_APPROVAL'
  let mode = false
  const bodies: Array<{ path: string; body: any }> = []
  const review = () => ({
    id: 'batch', status, revision_no: revision, generation: revision,
    dataset_kind: 'MASTER', master_id: 'master', master_version: 1,
    checkpoint: { close_open_periods: mode }, dependencies_current: true,
  })
  await page.route('**/api/v1/master-definitions/master', (route) => route.fulfill({ json: {
    status: 'success', data: { approved_definition_json: { policy: {
      new_record_policy: 'PROPOSE_INSERT', effective_dating: { valid_from_column: 'valid_from' },
    } } }, errors: [], meta: {},
  } }))
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = route.request().postDataJSON()
    const ok = (data: unknown) => route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (route.request().method() === 'GET') {
      return ok(path.endsWith('/batch') ? review() : { items: [], has_more: false })
    }
    bodies.push({ path, body })
    if (path.endsWith('/preview')) {
      mode = body.close_open_periods
      return ok({ review: review(), target: 'master', changes: [{ operation: 'INSERT', after: { code: 'P001' } }],
        summary: { INSERT: 1 }, preview_hash: 'hash', preview_token: `token-${revision}`, can_approve: true,
        period_closures: mode ? [{ record_id: 'old-record', revision_no: 3, column: 'valid_to', before: null, after: '2026-02-01' }] : [],
      })
    }
    if (path.endsWith('/approve')) { status = 'APPROVED'; return ok(review()) }
    if (path.endsWith('/revalidate')) { status = 'READY_FOR_APPROVAL'; revision++; mode = false; return ok(review()) }
    if (path.endsWith('/apply') && revision > 1) {
      status = 'SUCCEEDED'
      return ok({ review: review(), rows_applied: 0, periods_closed: 1 })
    }
    if (path.endsWith('/apply')) return route.fulfill({ status: 409, json: {
      status: 'error', data: null, errors: [{ code: 'IMPORT_PREVIEW_STALE', message: 'Target berubah' }], meta: {},
    } })
    throw new Error(`Unexpected ${path}`)
  })
  await page.goto('/import-reviews/batch')
  await login(page, 'admin')
  const option = page.getByLabel('Usulkan penutupan periode terbuka untuk batch ini')
  const preview = page.getByRole('button', { name: 'Buat preview', exact: true })
  await expect(option).not.toBeChecked()
  await preview.click()
  await expect(page.getByRole('heading', { name: 'Penutupan periode: 0' })).toBeVisible()
  expect(bodies.at(-1)?.body.close_open_periods).toBe(false)
  await option.check()
  await expect(page.getByRole('button', { name: 'Approve preview' })).toBeDisabled()
  await preview.click()
  await expect(page.getByRole('cell', { name: 'old-record', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '2026-02-01', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Approve preview' }).click()
  await expect(option).toBeDisabled()
  await page.getByRole('button', { name: 'Apply batch', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Revalidate')
  await expect(page.getByRole('button', { name: 'Apply batch', exact: true })).toBeDisabled()
  expect(bodies.at(-1)?.body).toEqual({ revision_no: 1, preview_token: 'token-1' })
  await page.getByRole('button', { name: 'Revalidate', exact: true }).click()
  await expect(option).toBeEnabled()
  await option.check()
  await preview.click()
  await expect(page.getByRole('heading', { name: 'Penutupan periode: 1' })).toBeVisible()
  expect(bodies.at(-1)?.body).toEqual({ revision_no: 2, close_open_periods: true })
  await page.getByRole('button', { name: 'Approve preview' }).click()
  await page.getByRole('button', { name: 'Apply batch', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('0 baris ditulis, 1 periode ditutup')
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
