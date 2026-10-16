import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('stale batch revalidation opens its replacement without carrying preview or applying', async ({ page }) => {
  const state = await setup(page)
  const writes: string[] = []
  await page.route('**/api/v1/import-reviews/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })
    if (route.request().method() === 'POST') {
      writes.push(path)
      expect(path).toBe('/api/v1/import-reviews/old/revalidate')
      expect(route.request().postDataJSON().revision_no).toBe(3)
      return ok({ id: 'old', status: 'STALE_REVIEW', replacement_review_id: 'new' })
    }
    if (path.endsWith('/old') || path.endsWith('/new')) {
      const old = path.endsWith('/old')
      return ok({ id: old ? 'old' : 'new', status: old ? 'STALE_REVIEW' : 'READY_FOR_APPROVAL',
        revision_no: old ? 3 : 1, generation: 1, dataset_kind: 'NON_MASTER',
        owner_workflow_enabled: true, dependencies_current: !old,
        checkpoint: { rows_valid: 12, blocking_codes: [], ai_coverage: 'COMPLETE' } })
    }
    return ok({ items: [], has_more: false })
  })
  await page.goto('/import-reviews/old')
  await login(page, 'editor')
  await expect(page.getByRole('heading', { name: /STALE_REVIEW/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buat preview', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Validasi ulang', exact: true }).click()
  await expect(page).toHaveURL(/\/import-reviews\/new$/)
  await expect(page.getByRole('heading', { name: /READY_FOR_APPROVAL/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buat preview', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Apply batch', exact: true })).toBeDisabled()
  expect(writes).toHaveLength(1)
  expect(state.errors).toEqual([])
})
