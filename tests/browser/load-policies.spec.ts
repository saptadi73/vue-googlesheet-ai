import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

for (const code of [
  'IMPORT_PREVIEW_STALE',
  'IMPORT_PREVIEW_REQUIRED',
  'APPEND_IDENTICAL_REJECTED',
]) {
  test(`${code} clears apply token and permits explicit revalidation`, async ({ page }) => {
    const state = await setup(page)
    let status = 'APPROVED'
    let revision = 2
    let applies = 0
    const review = () => ({
      id: 'batch',
      status,
      revision_no: revision,
      dataset_kind: code === 'APPEND_IDENTICAL_REJECTED' ? 'NON_MASTER' : 'MASTER',
      checkpoint: {},
      dependencies_current: true,
    })
    await page.route('**/api/v1/import-reviews/batch**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const ok = (data: unknown) =>
        route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
      if (path.endsWith('/batch')) return ok(review())
      if (path.endsWith('/preview'))
        return ok({
          review: review(),
          target: 'trusted.events',
          changes: [],
          summary: { INSERT: 2 },
          preview_hash: 'hash',
          preview_token: 'token',
          can_approve: false,
        })
      if (path.endsWith('/apply')) {
        applies++
        expect(route.request().postDataJSON()).toEqual({ revision_no: 2, preview_token: 'token' })
        return route.fulfill({
          status: 409,
          json: {
            status: 'error',
            data: null,
            errors: [{ code, message: 'Apply ditolak' }],
            meta: {},
          },
        })
      }
      if (path.endsWith('/revalidate')) {
        expect(route.request().postDataJSON().revision_no).toBe(2)
        status = 'READY_FOR_APPROVAL'
        revision++
        return ok(review())
      }
      return ok({ items: [], has_more: false })
    })
    await page.goto('/import-reviews/batch')
    await login(page)
    await page.getByRole('button', { name: 'Buat preview', exact: true }).click()
    await page.getByRole('button', { name: 'Apply batch', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Apply ditolak')
    await expect(page.getByRole('alert')).toContainText(
      code === 'APPEND_IDENTICAL_REJECTED' ? 'review ulang' : 'Revalidate',
    )
    await expect(page.getByRole('button', { name: 'Apply batch', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Revalidate', exact: true }).click()
    await expect(page.getByRole('heading', { name: /READY_FOR_APPROVAL/ })).toBeVisible()
    expect(applies).toBe(1)
    expect(state.errors).toEqual([])
  })
}

test('APPEND duplicate blocks approval and actual zero writes survive reload', async ({ page }) => {
  const state = await setup(page)
  let status = 'READY_FOR_APPROVAL'
  const review = () => ({
    id: 'batch',
    status,
    revision_no: 1,
    dataset_kind: 'NON_MASTER',
    checkpoint: { rows_valid: 3, rows_applied: 0 },
    dependencies_current: true,
  })
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/batch')
      ? review()
      : path.endsWith('/preview')
        ? {
            review: review(),
            target: 'trusted.events',
            changes: [
              { source_row: 2, outcome: 'DUPLICATE', before: null, after: { amount: '10.00' } },
            ],
            summary: { DUPLICATE: 1 },
            preview_hash: 'hash',
            can_approve: false,
            read_only: true,
          }
        : { items: [], has_more: false }
    return route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
  })
  await page.goto('/import-reviews/batch')
  await login(page, 'admin')
  await page.getByRole('button', { name: 'Baca preview editor', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'DUPLICATE', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve preview', exact: true })).toBeDisabled()
  status = 'SUCCEEDED'
  await page.getByRole('button', { name: 'Muat ulang status batch', exact: true }).click()
  await expect(page.getByText('Batch sudah selesai diaplikasikan', { exact: false })).toContainText(
    '0 baris ditulis',
  )
  await page.reload()
  await login(page, 'admin')
  await expect(page.getByText('Batch sudah selesai diaplikasikan', { exact: false })).toContainText(
    '0 baris ditulis',
  )
  expect(state.errors).toEqual([])
})
