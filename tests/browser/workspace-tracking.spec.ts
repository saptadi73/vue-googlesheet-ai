import { expect, test } from '@playwright/test'
import { configId, login, setup, sheetId, sourceId } from './fixtures'

for (const status of ['SUCCEEDED', 'NOT_STARTED']) {
  test(`workspace displays actual tracking ${status} rather than default zero`, async ({ page }) => {
    const state = await setup(page)
    state.sheet.active_configuration_id = configId
    Object.assign(state.sheet, { is_present: true, sheet_id: 0 })
    Object.assign(state.source, { spreadsheet_id: 'test-spreadsheet' })
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
    await expect(section.getByText(status === 'SUCCEEDED' ? '169 baris dimuat' : '0 baris dimuat', { exact: true })).toBeVisible()
    if (status === 'NOT_STARTED') await expect(section.locator('.stage-pill').filter({ hasText: 'Belum dimuat' })).toBeVisible()
    await expect(section.getByText('Tracking belum tersedia', { exact: true })).toHaveCount(0)
    await expect(section.getByRole('link', { name: 'Buka Google Sheet', exact: true })).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/test-spreadsheet/edit#gid=0')
    await section.getByRole('button', { name: 'Buka sumber', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Profil & pengaturan tab', exact: true })).toBeVisible()
    await section.getByRole('button', { name: 'Sync manual data', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Jalankan sync sekarang', exact: true })).toBeVisible()
    expect(state.requests.filter((request) => request.path.endsWith('/sync-review/start'))).toHaveLength(0)
    await page.getByRole('button', { name: 'Batal sync', exact: true }).click()
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
  await expect(section.getByText('26 baris dimuat', { exact: true })).toBeVisible()
  await expect(section.getByRole('alert')).toHaveCount(0)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('blocked loading opens an accessible read-only detail modal with paged findings', async ({ page }) => {
  const state = await setup(page)
  state.sheet.active_configuration_id = configId
  Object.assign(state.sheet, { is_present: true })
  state.record.status = 'ACTIVE'
  const reviewId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const attention = {
    review_id: reviewId, source_sheet_id: sheetId, status: 'NEEDS_INPUT', revision_no: 9,
    blocking_codes: ['AI_REVIEW_ISSUES'], ai_coverage: 'COMPLETE',
    message: 'Pemuatan berhenti menunggu tindakan. Menunggu saja tidak akan melanjutkan proses.',
  }
  await page.route('**/api/v1/sources/tracking?**', (route) => route.fulfill({
    json: { status: 'success', data: [{ ...state.source, database_status: 'NEEDS_INPUT', sheets: [{ id: sheetId, name: state.sheet.sheet_name, database_status: 'NEEDS_INPUT', rows_loaded: 0, attention }] }], meta: {}, errors: [] },
  }))
  let fail = true
  const offsets: string[] = []
  await page.route(`**/api/v1/import-reviews/${reviewId}/questions?**`, (route) => {
    const offset = new URL(route.request().url()).searchParams.get('offset') || '0'
    offsets.push(offset)
    if (fail) return route.fulfill({
      status: 503, json: { status: 'error', data: null, errors: [{ code: 'DETAIL_UNAVAILABLE', message: 'Detail tidak tersedia' }], meta: {} },
    })
    return route.fulfill({
      json: {
        status: 'success', meta: {}, errors: [], data: {
          items: [{ id: `question-${offset}`, source_row: Number(offset) + 2, target_column: 'level_jabatan', review_message: offset === '0' ? 'Dugaan nama pribadi pada kolom non-PII.' : 'Temuan berikutnya perlu diperiksa.' }],
          has_more: offset === '0',
        },
      },
    })
  })
  await page.goto(`/workspace?source_id=${sourceId}`)
  await login(page, 'admin')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tabel hasil ETL aktif pada sumber ini', exact: true }) })
  await expect(section.getByText('Menunggu tindakan', { exact: true })).toBeVisible()
  const button = section.getByRole('button', { name: `Lihat detail ${state.sheet.sheet_name}`, exact: true })
  await button.click()
  const modal = page.getByRole('dialog', { name: `Detail proses ${state.sheet.sheet_name}`, exact: true })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('alert')).toContainText('Detail tidak tersedia')
  fail = false
  await modal.getByRole('button', { name: 'Coba lagi', exact: true }).click()
  await expect(modal.getByText('Dugaan nama pribadi pada kolom non-PII.', { exact: true })).toBeVisible()
  await expect(modal.getByText('Baris 2 · Kolom level_jabatan', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Muat temuan berikutnya', exact: true }).click()
  await expect(modal.getByText('Temuan berikutnya perlu diperiksa.', { exact: true })).toBeVisible()
  await expect(modal.getByText('Baris 3 · Kolom level_jabatan', { exact: true })).toBeVisible()
  await expect(modal.getByRole('link', { name: 'Buka batch untuk tindak lanjut' })).toHaveAttribute('href', `/import-reviews/${reviewId}`)
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await expect(button).toBeFocused()
  expect(offsets).toEqual(['0', '0', '1'])
  expect(state.requests.filter((request) => request.method === 'POST' && (request.path.includes('/sync-review') || request.path.includes('/import-reviews')))).toHaveLength(0)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('source audit trail shows blocker explanation and a view modal', async ({ page }) => {
  const state = await setup(page)
  const attention = { status: 'NEEDS_INPUT', blocking_codes: ['AI_REVIEW_ISSUES'], message: 'Pemuatan berhenti: dugaan data pribadi perlu diperiksa.' }
  await page.route('**/api/v1/sources/tracking?**', (route) => route.fulfill({
    json: { status: 'success', data: [{ ...state.source, sheets: [], database_status: 'NEEDS_INPUT', last_failures: {} }], meta: { total: 1 }, errors: [] },
  }))
  await page.route(`**/api/v1/sources/${sourceId}/history?**`, (route) => route.fulfill({
    json: { status: 'success', data: [{ id: 'audit-input', occurred_at: '2026-10-11T03:00:00Z', stage: 'DATABASE', status: 'NEEDS_INPUT', summary: 'Pemuatan berhenti: menunggu tindakan', event: 'import.request_input', attention }], meta: { total: 1 }, errors: [] },
  }))
  await page.goto('/sources')
  await login(page, 'admin')
  await page.getByRole('button', { name: `Buka audit trail ${state.source.name}` }).click()
  const history = page.getByRole('dialog', { name: `Riwayat proses · ${state.source.name}` })
  await expect(history.getByText(attention.message, { exact: true })).toBeVisible()
  await history.getByRole('button', { name: /Lihat detail/ }).click()
  const detail = page.getByRole('dialog', { name: /Detail proses/ })
  await expect(detail.getByRole('status')).toHaveText(attention.message)
  await detail.getByRole('button', { name: 'Tutup detail proses' }).click()
  await expect(detail).not.toBeVisible()
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
