import { expect, test } from '@playwright/test'
import { configId, login, setup, sheetId, sourceId } from './fixtures'

for (const status of ['SUCCEEDED', 'NOT_STARTED']) {
  test(`workspace displays actual tracking ${status} rather than default zero`, async ({ page }) => {
    const state = await setup(page)
    state.sheet.active_configuration_id = configId
    Object.assign(state.sheet, { is_present: true })
    state.record.status = 'ACTIVE'
    await page.route('**/api/v1/sources/tracking?**', (route) => route.fulfill({
      json: {
        status: 'success',
        data: [{
          ...state.source,
          sheets: [{ id: sheetId, database_status: status, rows_loaded: status === 'SUCCEEDED' ? 169 : 0 }],
        }],
        meta: {}, errors: [],
      },
    }))
    await page.goto(`/workspace?source_id=${sourceId}`)
    await login(page, 'admin')
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tabel hasil ETL aktif pada sumber ini', exact: true }) })
    await expect(section.getByRole('cell', { name: status === 'SUCCEEDED' ? '169' : '0', exact: true })).toBeVisible()
    if (status === 'NOT_STARTED') await expect(section.getByText('Belum dimuat', { exact: true })).toBeVisible()
    await expect(section.getByText('Tracking belum tersedia', { exact: true })).toHaveCount(0)
    expect(state.errors).toEqual([])
    expect(state.unexpected).toEqual([])
  })
}

test('tracking failure stays explicit and can be retried without displaying zero', async ({ page }) => {
  const state = await setup(page)
  state.sheet.active_configuration_id = configId
  Object.assign(state.sheet, { is_present: true })
  state.record.status = 'ACTIVE'
  let failed = true
  await page.route('**/api/v1/sources/tracking?**', (route) => route.fulfill(failed ? {
    status: 503,
    json: { status: 'error', data: null, meta: {}, errors: [{ code: 'DATABASE_UNAVAILABLE', message: 'Tracking database tidak tersedia' }] },
  } : {
    json: { status: 'success', data: [{ ...state.source, sheets: [{ id: sheetId, database_status: 'SUCCEEDED', rows_loaded: 26 }] }], meta: {}, errors: [] },
  }))
  await page.goto(`/workspace?source_id=${sourceId}`)
  await login(page, 'admin')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tabel hasil ETL aktif pada sumber ini', exact: true }) })
  await expect(section.getByRole('alert')).toContainText('Tracking sumber gagal dimuat')
  await expect(section.getByText('Tracking belum tersedia', { exact: true })).toBeVisible()
  await expect(section.getByRole('cell', { name: '0', exact: true })).toHaveCount(0)
  failed = false
  await section.getByRole('button', { name: 'Muat ulang tracking sumber' }).click()
  await expect(section.getByRole('cell', { name: '26', exact: true })).toBeVisible()
  await expect(section.getByRole('alert')).toHaveCount(0)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
