import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

for (const action of ['approve', 'apply']) {
  test(`late ${action} response cannot replace a newly selected batch`, async ({ page }) => {
    const state = await setup(page)
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let started = false
    const review = (id: string, status = 'READY_FOR_APPROVAL') => ({
      id,
      status,
      revision_no: 1,
      generation: 1,
      dataset_kind: 'NON_MASTER',
      checkpoint: {},
      dependencies_current: true,
    })
    await page.route('**/api/v1/import-reviews/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const id = path.includes('/next') ? 'next' : 'first'
      const ok = (data: unknown) =>
        route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
      if (path.endsWith('/preview'))
        return ok({
          review: review(id, action === 'apply' ? 'APPROVED' : 'READY_FOR_APPROVAL'),
          changes: [],
          summary: {},
          preview_hash: 'hash',
          preview_token: 'token',
          can_approve: true,
        })
      if (route.request().method() === 'POST') {
        started = true
        await held
        return ok(
          action === 'apply'
            ? { review: review(id, 'SUCCEEDED'), rows_applied: 1, periods_closed: 0 }
            : review(id, 'APPROVED'),
        )
      }
      if (path.endsWith('/findings') || path.endsWith('/questions'))
        return ok({ items: [], has_more: false })
      return ok(
        review(id, id === 'first' && action === 'apply' ? 'APPROVED' : 'READY_FOR_APPROVAL'),
      )
    })
    await page.goto('/import-reviews/first')
    await login(page, 'admin')
    await page.getByRole('button', { name: 'Buat preview', exact: true }).click()
    await page
      .getByRole('button', {
        name: action === 'approve' ? 'Approve preview' : 'Apply batch',
        exact: true,
      })
      .click()
    await expect.poll(() => started).toBe(true)
    // Navigate within the SPA so the same view instance and pending request survive.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/import-reviews/next')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/next$/)
    release()
    await expect(page.locator('section.panel').first()).toContainText('next')
    await expect(page.locator('section.panel').first()).toContainText('READY_FOR_APPROVAL')
    await expect(page.getByRole('button', { name: 'Apply batch', exact: true })).toBeDisabled()
    expect(state.errors).toEqual([])
  })
}
