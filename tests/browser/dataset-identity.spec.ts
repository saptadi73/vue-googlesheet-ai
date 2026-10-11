import { expect, test } from '@playwright/test'
import { configId, login, setup, sheetId, sourceId } from './fixtures'

test('manual draft prefills file/tab identity and preserves edits during tracking reload', async ({ page }) => {
  const state = await setup(page)
  state.source.name = 'Nama sumber kustom'
  state.sheet.sheet_name = 'REKAP JENIS KELUHAN'
  Object.assign(state.sheet, { is_present: true })
  await page.route(`**/api/v1/sources/${sourceId}/profiling-runs`, (route) => route.fulfill({
    json: { status: 'success', data: [{
      id: 'profile', source_sheet_id: sheetId, status: 'SUCCEEDED', created_at: '2026-10-11T00:00:00Z',
      profile_json: {
        spreadsheet_title: 'Keluhan KAN Jabung 2026', sheet_name: 'REKAP JENIS KELUHAN',
        row_count: 2, warnings: [],
        columns: [{ source_column: 'Cabang', normalized_name: 'branch_name', inferred_type: 'text', pii_suspected: false, null_ratio: 0, distinct_ratio: 1 }],
      },
    }], meta: {}, errors: [] },
  }))
  await page.goto(`/workspace?source_id=${sourceId}`)
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Tab Google Sheet', exact: true }).click()
  await page.getByRole('option', { name: 'REKAP JENIS KELUHAN', exact: true }).click()
  await expect(page.getByLabel('Nama dataset', { exact: true })).toHaveValue('Keluhan KAN Jabung 2026 / REKAP JENIS KELUHAN')
  await expect(page.getByLabel('Kode analitik', { exact: true })).toHaveValue('keluhan_kan_jabung_2026_rekap_jenis_keluhan')
  await page.getByLabel('Nama dataset', { exact: true }).fill('Nama saya')
  await page.getByRole('button', { name: 'Muat ulang tracking sumber', exact: true }).click()
  await expect(page.getByLabel('Nama dataset', { exact: true })).toHaveValue('Nama saya')
  expect(state.errors).toEqual([])
})

test('existing review keeps saved identity until explicit file/tab suggestion is chosen', async ({ page }) => {
  const state = await setup(page)
  state.source.name = 'Keluhan KAN Jabung 2026'
  state.sheet.sheet_name = 'REKAP JENIS KELUHAN'
  const original = state.record.configuration_json.dataset_business_name
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue(original)
  await page.getByRole('button', { name: 'Gunakan nama file dan tab', exact: true }).click()
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue('Keluhan KAN Jabung 2026 / REKAP JENIS KELUHAN')
  const code = page.getByLabel('Kode produk data', { exact: true })
  await expect(code).toHaveValue('keluhan_kan_jabung_2026_rekap_jenis_keluhan')
  expect(await code.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true)
  expect(state.requests.filter((request) => request.method === 'PATCH' || request.path.endsWith('/approve'))).toHaveLength(0)
  expect(state.errors).toEqual([])
})

test('review automatically repairs pasted invalid code before save without changing business name', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  const businessName = state.record.configuration_json.dataset_business_name
  const code = page.getByLabel('Kode produk data', { exact: true })
  await code.fill('Keluhan KAN Jabung 2026 / ANGGOTA NON ANGGOTA')
  await page.getByLabel('Nama bisnis', { exact: true }).click()
  await expect(code).toHaveValue('keluhan_kan_jabung_2026_anggota_non_anggota')
  await expect(page.getByRole('status').filter({ hasText: 'Kode produk data dirapikan otomatis' })).toBeVisible()
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue(businessName)
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  const saved = state.requests.find(request => request.method === 'PATCH')
  expect(saved?.body.configuration.semantic.code).toBe('keluhan_kan_jabung_2026_anggota_non_anggota')
  expect(state.errors).toEqual([])
})
