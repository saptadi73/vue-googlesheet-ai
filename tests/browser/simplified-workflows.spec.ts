import { expect, test } from '@playwright/test'
import { configId, jobId, login, setup, sheetId, sourceId } from './fixtures'

test('public helper distinguishes direct sync, waiting findings and legacy approvals', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/guide#approval-gabungan')
  await expect(page.locator('#approval-gabungan')).toContainText('tidak perlu approval metadata terpisah')
  await page.goto('/guide#sync-manual')
  const guide = page.locator('#sync-manual')
  await expect(guide).toContainText('Menunggu tindakan')
  await expect(guide).toContainText('bukan masih berjalan')
  await expect(guide).toContainText('Menjawab temuan saja belum memuat data')
  await expect(guide).toContainText('Batch biasa/master tetap preview')
  await expect(guide).toContainText('baris')
  expect(state.requests.filter((request) => request.path.endsWith('/approve') || request.path.endsWith('/apply') || request.path.endsWith('/sync-review/start'))).toHaveLength(0)
  expect(state.errors).toEqual([])
})

test('combined approval explains metadata blockers and links to complete helper', async ({ page }) => {
  const state = await setup(page)
  state.record.status = 'NEEDS_REVIEW'
  state.record.review_state = { submitted_revision: 1, classification_revision: 2, dataset_kind: 'NON_MASTER' }
  await page.goto(`/configurations/${configId}/review`)
  await login(page, 'approver')
  await page.getByRole('button', { name: '7. Validasi & persetujuan' }).click()
  await page.getByRole('button', { name: 'Setujui konfigurasi', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Approval konfigurasi dan akses sumber' })
  await expect(modal.getByRole('status')).toContainText('Metadata wajib belum lengkap')
  await expect(modal.getByRole('button', { name: 'Konfirmasi setuju' })).toBeDisabled()
  await expect(modal.getByRole('link', { name: 'Helper lengkap: mengapa approval belum bisa disetujui' })).toHaveAttribute('href', '/guide#approval-gabungan')
  await expect(modal.getByRole('link', { name: 'Buka metadata sumber di Workspace' })).toHaveAttribute('href', `/workspace?source_id=${sourceId}`)
  expect(state.requests.filter((request) => request.path.endsWith('/approve'))).toHaveLength(0)
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
})

test('manual source sync shows per-tab results and reload does not enqueue again', async ({ page }) => {
  const state = await setup(page)
  let starts = 0
  const batchId = '88888888-8888-4888-8888-888888888888'
  await page.route(`**/api/v1/sources/${sourceId}/sync-review/start`, (route) => {
    starts++
    return route.fulfill({ status: 202, json: { status: 'success', data: { job_id: jobId, status: 'QUEUED' }, meta: {}, errors: [] } })
  })
  await page.route(`**/api/v1/jobs/${jobId}`, (route) => route.fulfill({
    json: { status: 'success', data: { id: jobId, status: 'SUCCEEDED', result: { reviews: [
      { id: batchId, source_sheet_id: sheetId, sheet_name: 'Sales', status: 'VALIDATING' },
      { source_sheet_id: 'unconfigured-tab', sheet_name: 'Holding', status: 'BLOCKED', code: 'IMPORT_CONFIGURATION_REQUIRED', message: 'Konfigurasi belum approved.' },
    ] } }, meta: {}, errors: [] },
  }))
  await page.route(`**/api/v1/import-reviews/${batchId}`, (route) => route.fulfill({
    json: { status: 'success', data: { id: batchId, source_sheet_id: sheetId, status: 'NEEDS_INPUT', finding_count: 2, checkpoint: { rows_valid: 169, ai_coverage: 'COMPLETE', blocking_codes: ['AI_REVIEW_ISSUES'] } }, meta: {}, errors: [] },
  }))
  await page.goto(`/workspace?source_id=${sourceId}`)
  await login(page, 'admin')
  await page.getByRole('button', { name: 'Sync manual', exact: true }).click()
  expect(starts).toBe(0)
  await page.getByRole('button', { name: 'Jalankan sync sekarang' }).click()
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Sync manual · Penjualan cabang' }) })
  await expect(panel).toContainText('169 baris valid')
  await expect(panel).toContainText('Menunggu tindakan')
  await expect(panel).toContainText('Holding · BLOCKED')
  await expect(panel).toContainText('Konfigurasi belum approved')
  await expect(panel.getByRole('link', { name: 'Buka hasil review' })).toHaveAttribute('href', `/import-reviews/${batchId}`)
  await panel.getByRole('button', { name: 'Muat ulang hasil sync' }).click()
  await expect(panel.getByRole('status')).toContainText('0 tab berhasil dimuat')
  expect(starts).toBe(1)
  expect(state.requests.filter((request) => request.path.endsWith('/approve') || request.path.endsWith('/apply'))).toHaveLength(0)
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
})

test('catalog keeps active output while a revision is updating and offers source shortcuts', async ({ page }) => {
  const state = await setup(page)
  await page.route('**/api/v1/semantic/data-product-inventory', (route) => route.fulfill({
    json: { status: 'success', data: [{
      ...state.product, source_id: sourceId, source_name: 'Penjualan cabang', source_code: 'sales',
      spreadsheet_id: 'sheet-file', spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-file/edit',
      sheet_name: 'Sales', sheet_id: 42, database_schema: 'trusted', database_table: 'sales_table', semantic_view: 'v_sales',
      configuration_id: configId, configuration_version: 1, configuration_status: 'ACTIVE',
      update_status: 'UPDATING', update_reason: 'Revisi konfigurasi: NEEDS_REVIEW',
      last_active_at: '2026-10-01T00:00:00Z', last_activated_at: '2026-10-01T00:00:00Z', last_loaded_at: null, last_profiled_at: '2026-10-10T00:00:00Z',
    }], meta: {}, errors: [] },
  }))
  await page.route('**/api/v1/semantic/join-relationships', (route) => route.fulfill({
    json: { status: 'success', data: [], meta: {}, errors: [] },
  }))
  await page.goto('/data-catalog')
  await login(page, 'admin')
  await expect(page.getByRole('cell', { name: /Sedang diperbarui/ })).toContainText('NEEDS_REVIEW')
  await expect(page.getByRole('cell', { name: /Konfigurasi aktif:/ })).toContainText('Belum dimuat')
  await expect(page.getByRole('link', { name: 'Buka Google Sheet', exact: true })).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/sheet-file/edit#gid=42')
  await expect(page.getByRole('link', { name: 'Buka sumber di Workspace', exact: true })).toHaveAttribute('href', `/workspace?source_id=${sourceId}`)
  expect(state.unexpected).toEqual([])
  expect(state.errors).toEqual([])
})

test('admin can review multiple account access requests with one explicit confirmation', async ({ page }) => {
  const state = await setup(page)
  const requests = [sourceId, sheetId, jobId].map((id, index) => ({
    id, requester_id: 'other-admin', subject_user_id: 'reader', request_type: 'ATTRIBUTE',
    status: 'PENDING', revision: 1, valid_from: '2026-10-01T00:00:00Z', valid_to: '2027-10-02T00:00:00Z',
    business_reason: 'Membaca laporan unit sesuai penugasan.',
    subject_user: { id: 'reader', username: 'reader', role: 'VIEWER' },
    requester: { id: 'other-admin', username: 'maker' },
    attribute: { id, kind: ['DEPARTMENT', 'BUSINESS_DOMAIN', 'JURISDICTION'][index], code: `SCOPE_${index}`, label: 'Scope pembaca' },
  }))
  let body: unknown
  let approved = false
  await page.route(/\/api\/v1\/access\/requests(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (path === '/access/requests/approve-batch') {
      body = route.request().postDataJSON()
      approved = true
      return route.fulfill({ json: { status: 'success', data: [], meta: {}, errors: [] } })
    }
    return route.fulfill({ json: { status: 'success', data: path.endsWith('/mine') || approved ? [] : requests, meta: {}, errors: [] } })
  })
  await page.goto('/access-requests')
  await login(page, 'admin')
  await expect(page.getByRole('checkbox', { name: /Pilih reader/ })).toHaveCount(3)
  for (const checkbox of await page.getByRole('checkbox', { name: /Pilih reader/ }).all()) await checkbox.check()
  await page.getByRole('button', { name: 'Setujui 3 permintaan terpilih' }).click()
  expect(body).toBeUndefined()
  await page.getByRole('dialog').getByRole('button', { name: 'Konfirmasi persetujuan akses' }).click()
  expect(body).toEqual({ requests: requests.map((request) => ({ id: request.id, revision: 1 })), note: '' })
  await expect(page.getByRole('status')).toContainText('satu transaksi')
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
