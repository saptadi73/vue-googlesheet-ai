import { expect, test } from '@playwright/test'
import { configId, login, setup, sourceId } from './fixtures'

test('admin configures IT and related-unit release gate', async ({ page }) => {
  const mock = await setup(page)
  await page.route('**/api/v1/access/attributes*', async (route) => {
    await route.fulfill({ json: { status: 'success', data: [{ id: sourceId, kind: 'DEPARTMENT', code: 'SALES', label: 'Penjualan', is_active: true }], meta: {}, errors: [] } })
  })
  await page.goto('/admin')
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Sumber data' }).selectOption(sourceId)
  await page.getByRole('button', { name: 'Muat aturan siap tayang' }).click()
  await page.getByRole('checkbox', { name: 'approver · TECHNICAL_APPROVER' }).check()
  await page.getByRole('combobox', { name: 'Tambahkan unit' }).selectOption(sourceId)
  await page.getByRole('button', { name: 'Tambah unit approval' }).click()
  await page.getByRole('checkbox', { name: 'viewer', exact: true }).check()
  await page.getByRole('button', { name: 'Simpan aturan siap tayang' }).click()
  await expect(page.getByRole('status')).toContainText('Aturan persetujuan siap tayang tersimpan')
  expect(mock.requests.find((request) => request.method === 'PUT' && request.path === `/release-approvals/sources/${sourceId}/policy`)?.body).toMatchObject({
    technical_approver_ids: ['approver-id'],
    unit_groups: [{ unit_id: sourceId, approver_ids: ['viewer-id'] }],
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('unit approver signs an approved version without admin access', async ({ page }) => {
  const mock = await setup(page)
  mock.record.status = 'APPROVED'
  mock.source.release_policy = {
    technical_approver_ids: ['approver-id'],
    unit_groups: [{ unit_id: sourceId, label: 'Penjualan', approver_ids: ['viewer-id'] }],
  }
  await page.goto('/release-approvals')
  await login(page, 'viewer')
  await expect(page.getByRole('heading', { name: 'Persetujuan sebelum tayang' })).toBeVisible()
  await expect(page.getByText('Penjualan cabang · versi 1')).toBeVisible()
  await page.getByRole('button', { name: 'Beri keputusan' }).click()
  await page.getByRole('textbox', { name: 'Catatan pemeriksaan' }).fill('Definisi penjualan sesuai')
  await page.getByRole('button', { name: 'Setujui', exact: true }).click()
  await expect(page.getByText('Menunggu persetujuan lengkap.')).toBeVisible()
  expect(mock.requests.find((request) => request.path === `/release-approvals/configurations/${configId}/decisions`)?.body).toMatchObject({
    group_type: 'UNIT', unit_id: sourceId, decision: 'APPROVE',
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('IT approval requires completed technical checklist', async ({ page }) => {
  const mock = await setup(page)
  mock.record.status = 'APPROVED'
  mock.source.release_policy = { technical_approver_ids: ['approver-id'], unit_groups: [] }
  await page.goto('/release-approvals')
  await login(page, 'approver')
  await page.getByRole('button', { name: 'Beri keputusan' }).click()
  await page.getByRole('textbox', { name: 'Catatan pemeriksaan' }).fill('Pemeriksaan teknis lulus')
  await expect(page.getByRole('button', { name: 'Setujui', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Skema dan mapping telah diperiksa' }).check()
  await page.getByRole('checkbox', { name: 'Hasil validasi dan kualitas data telah diperiksa' }).check()
  await page.getByRole('checkbox', { name: 'Keamanan dan akses data telah diperiksa' }).check()
  await page.getByRole('button', { name: 'Setujui', exact: true }).click()
  await expect(page.getByText('Semua persetujuan lengkap; siap deploy.')).toBeVisible()
  expect(mock.requests.find((request) => request.path === `/release-approvals/configurations/${configId}/decisions`)?.body.technical_checks).toEqual({
    schema_and_mapping: true, data_quality: true, security_and_access: true,
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})
