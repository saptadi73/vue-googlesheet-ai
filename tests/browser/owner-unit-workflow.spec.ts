import { test, expect } from '@playwright/test'
import { setup, login, configId, sourceId } from './fixtures'

test('owner mode opens deploy for a legacy approved configuration without release approval navigation', async ({ page }) => {
  const state = await setup(page, true)
  state.record.status = 'APPROVED'
  state.record.review_state = { classification_revision: state.sheet.classification_revision, dataset_kind: 'NON_MASTER' }
  await page.route(`**/api/v1/configurations/${configId}/review`, async route => {
    await route.fulfill({ json: { status: 'success', data: {
      configuration: state.record, source: state.source, sheet: state.sheet,
      classification: state.classification(), validation: { ...state.validation, ready_for_review: true },
      profile: { columns: [] }, owner_workflow_enabled: true,
      capabilities: { unsupported: [], max_workbook_bytes: 2_000_000 },
    }, errors: [], meta: {} } })
  })
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: /Langkah 7,/ }).click()
  await expect(page.getByRole('button', { name: 'Deploy konfigurasi', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deploy konfigurasi', exact: true })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Persetujuan tayang', exact: true })).toHaveCount(0)
  expect(state.errors).toEqual([])
})

test('owner source registration requires an active unit and makes other scopes optional', async ({ page }) => {
  const state = await setup(page, true)
  await page.goto('/workspace')
  await login(page)
  await page.getByText('Hubungkan Google Sheet baru', { exact: true }).click()
  const unit = page.locator('select').filter({ has: page.locator(`option[value="${sourceId}"]`) }).first()
  await expect(unit).toBeVisible()
  const domain = page.getByRole('combobox', { name: 'Domain bisnis', exact: true })
  await expect(domain).not.toHaveAttribute('required', '')
  await expect(page.getByRole('combobox', { name: 'Purpose', exact: true })).not.toHaveAttribute('required', '')
  await expect(page.getByRole('button', { name: 'Hubungkan & profiling', exact: true })).toBeEnabled()
  expect(state.errors).toEqual([])
})

test('source tracking explains owner validation instead of sending users to IT approval', async ({ page }) => {
  const state = await setup(page, true)
  await page.goto('/sources')
  await login(page)
  await expect(page.getByRole('columnheader', { name: /Validasi pengelola/ })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Approval IT', exact: true })).toHaveCount(0)
  expect(state.errors).toEqual([])
})
